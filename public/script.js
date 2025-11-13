// public/script.js

const CLIENT_ID = document.querySelector('meta[name="google-signin-client_id"]')?.getAttribute('content');
const API_BASE = ''; // same origin; server serves public/ so use relative URLs

let googleInitialized = false;
let tokenClient = null;

// Initialize Google Identity Services (GSI)
function initGSI() {
  console.log('🔧 Initializing Google Sign-In...');
  console.log('  - CLIENT_ID:', CLIENT_ID ? CLIENT_ID.substring(0, 20) + '...' : 'NOT FOUND');
  
  if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID not found in meta tag!');
    return;
  }
  
  if (!window.google || !google.accounts || !google.accounts.id) {
    console.log('⏳ GSI script not loaded yet, retrying in 300ms...');
    setTimeout(initGSI, 300);
    return;
  }

  try {
    console.log('📌 Initializing google.accounts.id...');
    
    // Initialize with callback
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    googleInitialized = true;
    console.log('✓ Google Sign-In initialized successfully');
    
    // Attach event listeners to buttons
    attachButtonListeners();
    
  } catch (err) {
    console.error('✗ Failed to initialize Google Sign-In:', err);
  }
}

// Attach click handlers to login buttons
function attachButtonListeners() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    console.log('🔗 Attaching click handler to login button');
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('👆 Login button clicked');
      openGoogleLogin();
    });
  }

  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    console.log('🔗 Attaching click handler to Get Started button');
    getStartedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('👆 Get Started button clicked');
      openGoogleLogin();
    });
  }
}

// Function to open Google login
function openGoogleLogin() {
  if (!googleInitialized) {
    console.error('❌ Google Sign-In not initialized yet');
    showLoginError('Google Sign-In is still loading. Please try again in a moment.');
    return;
  }

  try {
    console.log('🚀 Opening Google Sign-In...');
    
    // Create a hidden div to render the button
    let container = document.getElementById('google-signin-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'google-signin-container';
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);
    }
    
    // Clear previous content
    container.innerHTML = '';
    
    // Render the button
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_blue',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 250
    });
    
    // Wait a moment for the button to render, then click it
    setTimeout(() => {
      const button = container.querySelector('[role="button"]');
      if (button) {
        console.log('✓ Google button rendered, triggering click...');
        button.click();
      } else {
        console.warn('⚠️  Button not found, trying prompt method...');
        // Fallback to prompt
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.error('❌ Google prompt not displayed');
            showLoginError('Unable to open Google Sign-In. Please check your popup blocker settings.');
          } else if (notification.isSkippedMoment()) {
            console.log('ℹ️  User skipped the sign-in');
          }
        });
      }
    }, 100);
    
  } catch (err) {
    console.error('❌ Error opening Google login:', err);
    showLoginError('Failed to open Google Sign-In: ' + err.message);
  }
}

// Handle credential response from Google (client receives id_token)
async function handleCredentialResponse(response) {
  if (!response || !response.credential) {
    console.warn('❌ No credential returned from Google', response);
    showLoginError('Google Sign-In was cancelled or failed');
    return;
  }

  try {
    console.log('✓ Received credential from Google, sending to server...');
    
    // Show loading state
    updateLoginUI('loading');
    
    const r = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: response.credential })
    });

    console.log('Server response status:', r.status);
    console.log('Response headers:', r.headers.get('content-type'));
    
    // Always try to parse as JSON first
    let data;
    try {
      const text = await r.text();
      console.log('Raw response:', text);
      
      if (!text || text.trim() === '') {
        throw new Error('Empty response from server');
      }
      
      data = JSON.parse(text);
      console.log('✓ Parsed response data:', data);
    } catch (parseErr) {
      console.error('❌ Failed to parse response:', parseErr);
      throw new Error('Server returned invalid response format');
    }
    
    if (!r.ok) {
      throw new Error(data?.error || 'Auth verification failed');
    }

    // On success, save user data and redirect
    const user = data.user;
    const isNewUser = data.isNewUser;
    const accountComplete = data.accountComplete;
    
    console.log('✓ Successfully signed in:', user.email);
    console.log('  - Is new user:', isNewUser);
    console.log('  - Account complete:', accountComplete);
    
    // Save user data to localStorage
    localStorage.setItem('tokenhelp_user', JSON.stringify(user));
    
    // Save account completion status
    if (accountComplete) {
      localStorage.setItem('tokenhelp_account_complete', 'true');
    } else {
      localStorage.removeItem('tokenhelp_account_complete');
    }
    
    // Show success message
    const firstName = user.name.split(' ')[0];
    showSuccessMessage(`Welcome${accountComplete ? ' back' : ''}, ${firstName}! 🎉`);
    
    // Redirect based on account completion status
    setTimeout(() => {
      if (!accountComplete) {
        console.log('→ Redirecting to account creation...');
        window.location.href = '/create-account.html';
      } else {
        console.log('→ Redirecting to homepage...');
        window.location.href = '/home.html';
      }
    }, 1500);
    
  } catch (err) {
    console.error('❌ Authentication error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack
    });
    showLoginError('Login failed: ' + (err.message || 'unknown error'));
    updateLoginUI('error');
  }
}

// Update login button UI states
function updateLoginUI(state, user = null) {
  const loginBtn = document.getElementById('loginBtn');
  const getStartedBtn = document.getElementById('getStartedBtn');
  
  if (state === 'loading') {
    if (loginBtn) {
      loginBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⏳</span> Signing in...';
      loginBtn.disabled = true;
    }
    if (getStartedBtn) {
      getStartedBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⏳</span> Signing in...';
      getStartedBtn.disabled = true;
    }
  } else if (state === 'success' && user) {
    const firstName = user.name.split(' ')[0];
    if (loginBtn) {
      loginBtn.innerHTML = `✓ ${firstName}`;
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.85';
      loginBtn.style.cursor = 'default';
    }
    if (getStartedBtn) {
      getStartedBtn.innerHTML = '✓ Welcome to TokenHelp';
      getStartedBtn.disabled = true;
      getStartedBtn.style.opacity = '0.85';
      getStartedBtn.style.cursor = 'default';
    }
  } else if (state === 'error') {
    if (loginBtn) {
      loginBtn.innerHTML = `<svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg> Login with Google`;
      loginBtn.disabled = false;
    }
    if (getStartedBtn) {
      getStartedBtn.innerHTML = `<svg class="google-icon-hero" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg> Get Started with Google`;
      getStartedBtn.disabled = false;
    }
  }
}

// Show login error to user
function showLoginError(message) {
  console.error('❌ Login error:', message);
  showNotification(message, 'error');
}

// Show success message
function showSuccessMessage(message) {
  console.log('✓ Success:', message);
  showNotification(message, 'success');
}

// Show notification toast
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.notification-toast');
  existing.forEach(n => n.remove());
  
  const toast = document.createElement('div');
  toast.className = `notification-toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 10000;
    font-weight: 600;
    animation: slideInRight 0.3s ease-out;
    max-width: 400px;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Contact form submit -> POST /api/contact
async function initContactForm() {
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('contactStatus');

  if (!form) return;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    statusEl.textContent = '';

    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusEl.textContent = 'Please enter a valid email address.';
      statusEl.classList.add('error');
      statusEl.classList.remove('success');
      return;
    }
    if (!message || message.length < 6) {
      statusEl.textContent = 'Please type a message (6+ characters).';
      statusEl.classList.add('error');
      statusEl.classList.remove('success');
      return;
    }

    // Show loading state
    statusEl.textContent = 'Sending message...';
    statusEl.classList.remove('error', 'success');

    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message })
      });
      
      console.log('Contact response status:', r.status);
      
      // Check if response is JSON
      const contentType = r.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await r.json();
      } else {
        const text = await r.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server error - invalid response format');
      }
      
      console.log('Contact response data:', data);
      
      if (!r.ok) {
        throw new Error(data?.error || `Failed to send (Status: ${r.status})`);
      }

      statusEl.textContent = data.message || 'Message sent! Thank you.';
      statusEl.classList.add('success');
      statusEl.classList.remove('error');
      form.reset();
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        statusEl.textContent = '';
      }, 5000);
    } catch (err) {
      console.error('Contact send error:', err);
      statusEl.textContent = 'Failed to send message. Error: ' + err.message;
      statusEl.classList.add('error');
      statusEl.classList.remove('success');
    }
  });
}

// Parallax subtle hero background movement
function initParallax(){
  const heroBg = document.getElementById('heroBg');
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', () => {
    const sc = window.scrollY || window.pageYOffset;
    
    // Parallax effect
    if (heroBg) {
      heroBg.style.transform = `translateY(${sc * -0.04}px)`;
    }
    
    // Navbar scroll effect
    if (navbar) {
      if (sc > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  }, { passive: true });
}

// Initialize smooth scroll for navigation links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '#features') {
        const target = document.querySelector(href);
        if (target && target.id !== 'getStartedBtn') {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

// Add CSS animations dynamically
function addAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Initialize all components
function initializeApp() {
  console.log('📄 Initializing TokenHelp app...');
  addAnimations();
  initGSI();
  initContactForm();
  initParallax();
  initSmoothScroll();
  console.log('✓ All components initialized');
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
