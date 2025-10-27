// Main JavaScript file for SecureVote E-Voting System

// Global state management
const AppState = {
    currentUser: null,
    currentElection: null,
    votes: {},
    isAuthenticated: false,
    currentPage: window.location.pathname.split('/').pop() || 'index.html'
};

// Utility functions
const Utils = {
    // Animate numbers counting up
    animateCounter: (element, target, duration = 2000) => {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format number with commas
            const formatted = Math.floor(current).toLocaleString();
            element.textContent = formatted;
        }, 16);
    },

    // Show notification
    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add notification styles if not exists
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    background: var(--surface);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: var(--space-4);
                    backdrop-filter: blur(20px);
                    z-index: 3000;
                    animation: slideInRight 0.3s ease;
                    max-width: 400px;
                }
                .notification-success { border-color: var(--success-color); }
                .notification-error { border-color: var(--error-color); }
                .notification-warning { border-color: var(--warning-color); }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .notification i {
                    font-size: var(--font-size-lg);
                }
                .notification-success i { color: var(--success-color); }
                .notification-error i { color: var(--error-color); }
                .notification-warning i { color: var(--warning-color); }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    },

    // Format time
    formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    // Save to localStorage
    saveToStorage: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },

    // Load from localStorage
    loadFromStorage: (key) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }
};

// Authentication system
const Auth = {
    // Mock user database
    users: [
        {
            id: 1,
            email: 'john.doe@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
            voterID: 'VID123456789'
        },
        {
            id: 2,
            email: 'admin@securevote.com',
            password: 'admin123',
            firstName: 'Admin',
            lastName: 'User',
            voterID: 'ADMIN001',
            isAdmin: true
        }
    ],

    // Login function
    login: (email, password) => {
        const user = Auth.users.find(u => u.email === email && u.password === password);
        if (user) {
            AppState.currentUser = user;
            AppState.isAuthenticated = true;
            Utils.saveToStorage('currentUser', user);
            return { success: true, user };
        }
        return { success: false, message: 'Invalid email or password' };
    },

    // Register function
    register: (userData) => {
        // Check if email already exists
        const existingUser = Auth.users.find(u => u.email === userData.email);
        if (existingUser) {
            return { success: false, message: 'Email already registered' };
        }

        // Create new user
        const newUser = {
            id: Auth.users.length + 1,
            ...userData
        };
        Auth.users.push(newUser);
        
        return { success: true, message: 'Registration successful' };
    },

    // Logout function
    logout: () => {
        AppState.currentUser = null;
        AppState.isAuthenticated = false;
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    },

    // Check authentication status
    checkAuth: () => {
        const user = Utils.loadFromStorage('currentUser');
        if (user) {
            AppState.currentUser = user;
            AppState.isAuthenticated = true;
        }
        return AppState.isAuthenticated;
    }
};

// Voting system
const VotingSystem = {
    // Initialize voting interface
    init: () => {
        VotingSystem.setupCandidateSelection();
        VotingSystem.setupTimer();
        VotingSystem.setupReviewModal();
        VotingSystem.updateProgress();
    },

    // Setup candidate selection
    setupCandidateSelection: () => {
        const candidateCards = document.querySelectorAll('.candidate-card, .proposition-card');
        
        candidateCards.forEach(card => {
            card.addEventListener('click', () => {
                const position = card.dataset.position;
                const candidate = card.dataset.candidate;
                
                // Remove selection from other candidates in same position
                const samePositionCards = document.querySelectorAll(`[data-position="${position}"]`);
                samePositionCards.forEach(c => c.classList.remove('selected'));
                
                // Add selection to clicked candidate
                card.classList.add('selected');
                
                // Update votes state
                AppState.votes[position] = candidate;
                
                // Update progress
                VotingSystem.updateProgress();
                
                // Show feedback
                Utils.showNotification(`Vote recorded for ${position}`, 'success');
            });
        });
    },

    // Setup voting timer
    setupTimer: () => {
        const timerElement = document.getElementById('votingTimer');
        if (!timerElement) return;

        let timeLeft = 30 * 60; // 30 minutes in seconds
        
        const updateTimer = () => {
            timerElement.textContent = Utils.formatTime(timeLeft);
            
            if (timeLeft <= 300) { // Last 5 minutes
                timerElement.style.color = 'var(--error-color)';
            } else if (timeLeft <= 600) { // Last 10 minutes
                timerElement.style.color = 'var(--warning-color)';
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                VotingSystem.autoSubmit();
            }
            
            timeLeft--;
        };
        
        const timer = setInterval(updateTimer, 1000);
        updateTimer(); // Initial call
    },

    // Update voting progress
    updateProgress: () => {
        const progressFill = document.getElementById('votingProgress');
        const progressText = document.querySelector('.progress-text');
        const submitBtn = document.getElementById('submitBtn');
        
        if (!progressFill) return;

        const totalPositions = 3; // President, Senate, Proposition
        const votedPositions = Object.keys(AppState.votes).length;
        const requiredVotes = 2; // President and Senate are required
        
        const progress = (votedPositions / totalPositions) * 100;
        progressFill.style.width = `${progress}%`;
        
        if (progressText) {
            progressText.textContent = `${votedPositions} of ${totalPositions} positions voted`;
        }
        
        // Enable submit button if required votes are cast
        if (submitBtn) {
            const hasRequiredVotes = AppState.votes.president && AppState.votes.senate;
            submitBtn.disabled = !hasRequiredVotes;
        }
    },

    // Setup review modal
    setupReviewModal: () => {
        const reviewBtn = document.getElementById('reviewBtn');
        const modal = document.getElementById('reviewModal');
        const closeBtn = modal?.querySelector('.modal-close');
        const editBtn = document.getElementById('editBtn');
        const confirmBtn = document.getElementById('confirmSubmitBtn');
        
        if (!reviewBtn || !modal) return;

        reviewBtn.addEventListener('click', () => {
            VotingSystem.showReviewModal();
        });

        closeBtn?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        editBtn?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        confirmBtn?.addEventListener('click', () => {
            VotingSystem.submitBallot();
        });

        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    },

    // Show review modal
    showReviewModal: () => {
        const modal = document.getElementById('reviewModal');
        const reviewContent = document.getElementById('reviewContent');
        
        if (!modal || !reviewContent) return;

        // Generate review content
        let content = '<div class="review-selections">';
        
        if (AppState.votes.president) {
            content += `
                <div class="review-item">
                    <h4>President</h4>
                    <p>${VotingSystem.getCandidateName('president', AppState.votes.president)}</p>
                </div>
            `;
        }
        
        if (AppState.votes.senate) {
            content += `
                <div class="review-item">
                    <h4>U.S. Senate</h4>
                    <p>${VotingSystem.getCandidateName('senate', AppState.votes.senate)}</p>
                </div>
            `;
        }
        
        if (AppState.votes.proposition) {
            content += `
                <div class="review-item">
                    <h4>Proposition 15</h4>
                    <p>${AppState.votes.proposition.toUpperCase()}</p>
                </div>
            `;
        }
        
        content += '</div>';
        
        // Add review styles
        if (!document.querySelector('#review-styles')) {
            const styles = document.createElement('style');
            styles.id = 'review-styles';
            styles.textContent = `
                .review-selections {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .review-item {
                    padding: var(--space-4);
                    background: var(--surface);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }
                .review-item h4 {
                    font-size: var(--font-size-lg);
                    font-weight: 600;
                    margin-bottom: var(--space-2);
                    color: var(--primary-color);
                }
                .review-item p {
                    color: var(--text-secondary);
                }
            `;
            document.head.appendChild(styles);
        }
        
        reviewContent.innerHTML = content;
        modal.classList.add('active');
    },

    // Get candidate name by position and ID
    getCandidateName: (position, candidateId) => {
        const candidates = {
            president: {
                johnson: 'Sarah Johnson (Democratic)',
                williams: 'Michael Williams (Republican)',
                davis: 'Robert Davis (Independent)'
            },
            senate: {
                martinez: 'Maria Martinez (Democratic)',
                thompson: 'James Thompson (Republican)'
            }
        };
        
        return candidates[position]?.[candidateId] || candidateId;
    },

    // Submit ballot
    submitBallot: () => {
        const modal = document.getElementById('reviewModal');
        
        // Simulate ballot submission
        Utils.showNotification('Submitting your ballot...', 'info');
        
        setTimeout(() => {
            // Save votes to storage
            Utils.saveToStorage('userVotes', AppState.votes);
            Utils.saveToStorage('voteTimestamp', new Date().toISOString());
            
            Utils.showNotification('Ballot submitted successfully!', 'success');
            
            setTimeout(() => {
                window.location.href = 'results.html';
            }, 2000);
        }, 2000);
        
        modal?.classList.remove('active');
    },

    // Auto submit when time runs out
    autoSubmit: () => {
        if (AppState.votes.president && AppState.votes.senate) {
            Utils.showNotification('Time expired! Auto-submitting your ballot...', 'warning');
            setTimeout(() => VotingSystem.submitBallot(), 2000);
        } else {
            Utils.showNotification('Time expired! Please complete required votes.', 'error');
        }
    }
};

// Results system
const ResultsSystem = {
    // Initialize results page
    init: () => {
        ResultsSystem.updateLastUpdated();
        ResultsSystem.animateResults();
        
        // Auto-refresh every 2 minutes
        setInterval(() => {
            ResultsSystem.updateLastUpdated();
            ResultsSystem.simulateResultUpdates();
        }, 120000);
    },

    // Update last updated timestamp
    updateLastUpdated: () => {
        const element = document.getElementById('lastUpdated');
        if (element) {
            element.textContent = 'Just now';
        }
    },

    // Animate result bars
    animateResults: () => {
        const progressBars = document.querySelectorAll('.results-section .progress-fill');
        
        progressBars.forEach((bar, index) => {
            setTimeout(() => {
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            }, index * 200);
        });
    },

    // Simulate result updates
    simulateResultUpdates: () => {
        // This would normally fetch real data from a server
        Utils.showNotification('Results updated', 'info');
        ResultsSystem.animateResults();
    }
};

// Admin system
const AdminSystem = {
    // Initialize admin dashboard
    init: () => {
        AdminSystem.setupSidebarNavigation();
        AdminSystem.animateDashboardMetrics();
        AdminSystem.setupCharts();
    },

    // Setup sidebar navigation
    setupSidebarNavigation: () => {
        const menuItems = document.querySelectorAll('.menu-item');
        const sections = document.querySelectorAll('.admin-section');
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.dataset.section;
                
                // Update active menu item
                menuItems.forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');
                
                // Show corresponding section
                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === sectionId) {
                        section.classList.add('active');
                    }
                });
            });
        });
    },

    // Animate dashboard metrics
    animateDashboardMetrics: () => {
        const metrics = [
            { selector: '.dashboard-card:nth-child(1) .metric-number', target: 3 },
            { selector: '.dashboard-card:nth-child(2) .metric-number', target: 1247832 },
            { selector: '.dashboard-card:nth-child(3) .metric-number', target: 892456 }
        ];
        
        metrics.forEach(metric => {
            const element = document.querySelector(metric.selector);
            if (element) {
                Utils.animateCounter(element, metric.target);
            }
        });
    },

    // Setup interactive charts
    setupCharts: () => {
        const bars = document.querySelectorAll('.bar');
        
        bars.forEach((bar, index) => {
            bar.addEventListener('mouseenter', () => {
                // Show tooltip or additional info
                const tooltip = document.createElement('div');
                tooltip.className = 'chart-tooltip';
                tooltip.textContent = `${20 + index * 10}% activity`;
                tooltip.style.cssText = `
                    position: absolute;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    padding: var(--space-2) var(--space-3);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                    z-index: 1000;
                    pointer-events: none;
                    border: 1px solid var(--border-color);
                `;
                
                document.body.appendChild(tooltip);
                
                const rect = bar.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
                
                bar.addEventListener('mouseleave', () => {
                    tooltip.remove();
                }, { once: true });
            });
        });
    }
};

// Form handling
const FormHandler = {
    // Setup all forms
    init: () => {
        FormHandler.setupLoginForm();
        FormHandler.setupRegisterForm();
        FormHandler.setupPasswordToggles();
        FormHandler.setupPasswordStrength();
    },

    // Setup login form
    setupLoginForm: () => {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const email = formData.get('email');
            const password = formData.get('password');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            FormHandler.setLoading(submitBtn, true);
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const result = Auth.login(email, password);
            
            FormHandler.setLoading(submitBtn, false);
            
            if (result.success) {
                Utils.showNotification('Login successful!', 'success');
                setTimeout(() => {
                    if (result.user.isAdmin) {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'voting.html';
                    }
                }, 1000);
            } else {
                Utils.showNotification(result.message, 'error');
            }
        });
    },

    // Setup register form
    setupRegisterForm: () => {
        const form = document.getElementById('registerForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const userData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                voterID: formData.get('voterID'),
                password: formData.get('password')
            };
            
            const confirmPassword = formData.get('confirmPassword');
            
            // Validate passwords match
            if (userData.password !== confirmPassword) {
                Utils.showNotification('Passwords do not match', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            FormHandler.setLoading(submitBtn, true);
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const result = Auth.register(userData);
            
            FormHandler.setLoading(submitBtn, false);
            
            if (result.success) {
                Utils.showNotification('Registration successful! Please login.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                Utils.showNotification(result.message, 'error');
            }
        });
    },

    // Setup password toggles
    setupPasswordToggles: () => {
        window.togglePassword = (inputId) => {
            const input = document.getElementById(inputId);
            const toggle = input.parentElement.querySelector('.password-toggle i');
            
            if (input.type === 'password') {
                input.type = 'text';
                toggle.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                toggle.className = 'fas fa-eye';
            }
        };
    },

    // Setup password strength indicator
    setupPasswordStrength: () => {
        const passwordInput = document.getElementById('regPassword');
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');
        
        if (!passwordInput || !strengthFill || !strengthText) return;

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const strength = FormHandler.calculatePasswordStrength(password);
            
            strengthFill.style.width = `${strength.percentage}%`;
            strengthFill.className = `strength-fill ${strength.level}`;
            strengthText.textContent = `Password strength: ${strength.label}`;
        });
    },

    // Calculate password strength
    calculatePasswordStrength: (password) => {
        let score = 0;
        
        if (password.length >= 8) score += 25;
        if (/[a-z]/.test(password)) score += 25;
        if (/[A-Z]/.test(password)) score += 25;
        if (/[0-9]/.test(password)) score += 25;
        if (/[^A-Za-z0-9]/.test(password)) score += 25;
        
        if (score <= 25) return { percentage: 25, level: 'weak', label: 'Weak' };
        if (score <= 50) return { percentage: 50, level: 'medium', label: 'Medium' };
        if (score <= 75) return { percentage: 75, level: 'strong', label: 'Strong' };
        return { percentage: 100, level: 'strong', label: 'Very Strong' };
    },

    // Set loading state for buttons
    setLoading: (button, loading) => {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
};

// Navigation handler
const Navigation = {
    // Setup navigation
    init: () => {
        Navigation.setupMobileMenu();
        Navigation.setupSmoothScrolling();
    },

    // Setup mobile menu
    setupMobileMenu: () => {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        if (!hamburger || !navMenu) return;

        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    },

    // Setup smooth scrolling for anchor links
    setupSmoothScrolling: () => {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
};

// Stats animation for homepage
const StatsAnimation = {
    // Initialize stats animation
    init: () => {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        if (statNumbers.length === 0) return;

        // Use Intersection Observer to trigger animation when stats come into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.dataset.target);
                    Utils.animateCounter(entry.target, target);
                    observer.unobserve(entry.target);
                }
            });
        });

        statNumbers.forEach(stat => {
            observer.observe(stat);
        });
    }
};

// Initialize application based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status
    Auth.checkAuth();
    
    // Initialize common components
    Navigation.init();
    FormHandler.init();
    
    // Page-specific initialization
    const currentPage = AppState.currentPage;
    
    if (currentPage === 'index.html' || currentPage === '') {
        StatsAnimation.init();
    } else if (currentPage === 'voting.html') {
        if (!AppState.isAuthenticated) {
            window.location.href = 'login.html';
            return;
        }
        VotingSystem.init();
    } else if (currentPage === 'results.html') {
        ResultsSystem.init();
    } else if (currentPage === 'admin.html') {
        if (!AppState.isAuthenticated || !AppState.currentUser?.isAdmin) {
            window.location.href = 'login.html';
            return;
        }
        AdminSystem.init();
    }
    
    // Add some demo data for testing
    if (!Utils.loadFromStorage('demoDataLoaded')) {
        Utils.saveToStorage('demoDataLoaded', true);
        console.log('Demo credentials:');
        console.log('Voter: john.doe@example.com / password123');
        console.log('Admin: admin@securevote.com / admin123');
    }
});

// Add global error handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    Utils.showNotification('An unexpected error occurred', 'error');
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC key to close modals
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
        }
    }
    
    // Ctrl+Enter to submit forms
    if (e.ctrlKey && e.key === 'Enter') {
        const activeForm = document.querySelector('form:focus-within');
        if (activeForm) {
            const submitBtn = activeForm.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
            }
        }
    }
});

// Export for potential use in other scripts
window.SecureVote = {
    AppState,
    Utils,
    Auth,
    VotingSystem,
    ResultsSystem,
    AdminSystem,
    FormHandler,
    Navigation
};