document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('claimForm');
    const steps = document.querySelectorAll('.form-step');
    const progressBar = document.getElementById('progress');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    let currentStep = 1;

    // Validation patterns
    const patterns = {
        email: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
        phone: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
        name: /^[a-zA-Z\s]{2,50}$/
    };

    // Error messages
    const errorMessages = {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        name: 'Please enter a valid name (2-50 characters, letters only)',
        moveDate: 'Move date cannot be in the future',
        itemWeight: 'Weight must be greater than 0',
        minLength: 'Please provide more details (minimum 20 characters)'
    };

    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        const existingError = formGroup.querySelector('.error-message');
        
        input.classList.add('error');
        
        if (!existingError) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            formGroup.appendChild(errorDiv);
        } else {
            existingError.textContent = message;
        }
    }

    function removeError(input) {
        const formGroup = input.closest('.form-group');
        const existingError = formGroup.querySelector('.error-message');
        
        input.classList.remove('error');
        if (existingError) {
            existingError.remove();
        }
    }

    function validateField(input) {
        const value = input.value.trim();
        
        // Required field validation
        if (input.required && !value) {
            showError(input, errorMessages.required);
            return false;
        }

        // Specific field validations
        switch(input.id) {
            case 'email':
                if (!patterns.email.test(value)) {
                    showError(input, errorMessages.email);
                    return false;
                }
                break;

            case 'phone':
                if (!patterns.phone.test(value)) {
                    showError(input, errorMessages.phone);
                    return false;
                }
                break;

            case 'name':
                if (!patterns.name.test(value)) {
                    showError(input, errorMessages.name);
                    return false;
                }
                break;

            case 'moveDate':
                const moveDate = new Date(value);
                const today = new Date();
                if (moveDate > today) {
                    showError(input, errorMessages.moveDate);
                    return false;
                }
                break;

            case 'itemWeight':
                if (parseInt(value) <= 0) {
                    showError(input, errorMessages.itemWeight);
                    return false;
                }
                break;

            case 'description':
                if (value.length < 20) {
                    showError(input, errorMessages.minLength);
                    return false;
                }
                break;
        }

        removeError(input);
        return true;
    }

    // Add real-time validation
    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
        });
    });

    // Show progress bar
    function showStep(step) {
        steps.forEach(s => s.classList.remove('active'));
        document.querySelector(`.form-step[data-step="${step}"]`).classList.add('active');
        progressBar.style.width = `${((step - 1) / (steps.length - 1)) * 100}%`;
        
        // Update progress steps
        document.querySelectorAll('.progress-step').forEach((s, i) => {
            if (i + 1 <= step) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    }

    // Image preview functionality
    const imageInput = document.getElementById('images');
    const imagePreview = document.getElementById('imagePreview');

    imageInput.addEventListener('change', function() {
        imagePreview.innerHTML = '';
        [...this.files].forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    // Next button click handler
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStep++;
            showStep(currentStep);
        });
    });

    // Previous button click handler
    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStep--;
            showStep(currentStep);
        });
    });

    // Add this function at the top level of your file
    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <h3>Submitting Your Claim</h3>
                <div class="progress-container">
                    <div class="progress-bar-loading"></div>
                </div>
                <div class="loading-message">Please wait while we process your claim...</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // Update your form submission code
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const loadingOverlay = showLoadingOverlay();
        const formData = new FormData(this);

        try {
            const response = await fetch('/api/submit-claim', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || 'Failed to submit claim');
            }

            const result = await response.json();
            
            // Remove loading overlay
            loadingOverlay.remove();
            
            if (result.success) {
                const successMessage = document.createElement('div');
                successMessage.className = 'success-message';
                successMessage.innerHTML = `
                    <div class="success-checkmark"></div>
                    <h2>Claim Submitted Successfully!</h2>
                    <p>Thank you for submitting your claim. We will review it shortly.</p>
                    <p>A confirmation email has been sent to your email address.</p>
                    <button onclick="window.location.reload()">Submit Another Claim</button>
                `;
                document.getElementById('claimForm').style.display = 'none';
                document.getElementById('claimForm').parentNode.appendChild(successMessage);
            } else {
                throw new Error('Failed to submit claim');
            }
        } catch (error) {
            // Remove loading overlay
            loadingOverlay.remove();
            
            console.error('Error:', error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.innerHTML = `
                <h2>Submission Failed</h2>
                <p>There was an error submitting your claim. Please try again later.</p>
                <button onclick="this.parentElement.remove()">Close</button>
            `;
            document.getElementById('claimForm').parentNode.insertBefore(errorMessage, document.getElementById('claimForm'));
        }
    });

    // Add preview for file inputs
    document.getElementById('images').addEventListener('change', function(e) {
        const previewContainer = document.getElementById('imagePreview');
        previewContainer.innerHTML = '';

        Array.from(this.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.createElement('div');
                preview.className = 'preview-item';
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <span class="filename">${file.name}</span>
                `;
                previewContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        });
    });
}); 