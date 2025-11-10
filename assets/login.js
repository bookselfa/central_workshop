// --- Wait for the page to load ---
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    const loginCard = document.getElementById('login-card');
    if (loader) loader.classList.add('hidden');
    if (loginCard) loginCard.classList.add('loaded');
});

// --- Firebase Configuration ---
// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "AIzaSyCD8kg0sb_PLnRYblhtRBKDLM50SwAesa8",
    authDomain: "centralworkshop-8b6af.firebaseapp.com",
    projectId: "centralworkshop-8b6af",
    storageBucket: "centralworkshop-8b6af.firebasestorage.app",
    messagingSenderId: "111684741547",
    appId: "1:111684741547:web:de4a9352e6636e961d8aee",
    measurementId: "G-0NH62G543Z"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const status = document.getElementById('status');
const registerStatus = document.getElementById('register-status');
const forgotLink = document.getElementById('forgot');

// --- Helper Functions ---
const showStatus = (elem, type, text) => {
    if (elem) {
        elem.className = 'status ' + (type === 'ok' ? 'success' : 'error');
        elem.textContent = text;
        elem.style.display = 'block';
    }
};

const clearStatus = () => {
    if (status) {
        status.textContent = '';
        status.className = 'status';
        status.style.display = 'none';
    }
    if (registerStatus) {
        registerStatus.textContent = '';
        registerStatus.className = 'status';
        registerStatus.style.display = 'none';
    }
};

const switchToLogin = () => {
    clearStatus();
    if (registerForm) registerForm.classList.add('hidden');
    setTimeout(() => {
        if (loginForm) loginForm.classList.remove('hidden');
    }, 50);
};

const switchToRegister = () => {
    clearStatus();
    if (loginForm) loginForm.classList.add('hidden');
    setTimeout(() => {
        if (registerForm) registerForm.classList.remove('hidden');
    }, 50);
};

// --- Event Listeners for Form Switching ---
if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchToRegister(); });
if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchToLogin(); });


// =========================================
// --- FIREBASE AUTH LOGIC ---
// =========================================

// 1. LOGIN
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();
        const pass = loginForm.password.value;

        if (!email || !pass) {
            showStatus(status, 'err', 'Please fill in both email and password.');
            return;
        }
        showStatus(status, 'ok', 'Signing in...');

        auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                return db.collection('users').doc(userCredential.user.uid).get();
            })
            .then((doc) => {
                if (doc.exists) {
                    const role = doc.data().role;
                    showStatus(status, 'ok', 'Login successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = (role === 'admin') ? './admin.html' : './user.html';
                    }, 1000);
                } else {
                    // Auto-create profile if missing (rare fallback)
                    return db.collection('users').doc(userCredential.user.uid).set({
                        email: email,
                        role: 'student',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).then(() => {
                        window.location.href = './user.html';
                    });
                }
            })
            .catch((error) => {
                console.error("Login Error:", error);
                let msg = "Invalid credentials.";
                if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
                if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
                showStatus(status, 'err', msg);
            });
    });
}

// 2. REGISTRATION (OPTIMIZED FOR SPEED)
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passInput = document.getElementById('register-password');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const pass = passInput.value;

        if (!name || !email || !pass) {
            showStatus(registerStatus, 'err', 'Please fill in all fields.');
            return;
        }
        if (pass.length < 6) {
             showStatus(registerStatus, 'err', 'Password must be at least 6 characters.');
             return;
        }

        // Disable button to prevent double-submit
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        showStatus(registerStatus, 'ok', 'Creating account...');

        auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                // 1. AUTH SUCCESS: Show success message immediately!
                showStatus(registerStatus, 'ok', 'Account created! Redirecting...');
                
                // 2. FIRESTORE SAVE: Happens in background while we wait to redirect
                const saveProfilePromise = db.collection('users').doc(userCredential.user.uid).set({
                    fullName: name,
                    email: email,
                    role: 'student',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 3. REDIRECT: After 1.5s, switch to login regardless of slow Firestore
                setTimeout(() => {
                    registerForm.reset();
                    switchToLogin();
                    showStatus(status, 'ok', 'Please log in with your new account.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Register';
                }, 1500);

                return saveProfilePromise;
            })
            .catch((error) => {
                console.error("Registration Error:", error);
                let msg = error.message;
                if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
                if (error.code === 'auth/invalid-email') msg = "Please enter a valid email address.";
                if (error.code === 'auth/weak-password') msg = "Password is too weak.";
                showStatus(registerStatus, 'err', msg);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register';
            });
    });
}

// 3. FORGOT PASSWORD
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();
        if (!email) {
            showStatus(status, 'err', 'Enter your email in the login form first, then click "Forgot password?".');
            return;
        }
        auth.sendPasswordResetEmail(email)
            .then(() => showStatus(status, 'ok', 'Password reset link sent to your email.'))
            .catch((error) => showStatus(status, 'err', error.message));
    });
} 