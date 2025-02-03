document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verify token using session
        const verifyResponse = await fetch('/api/verify-token', {
            credentials: 'include'
        });

        if (!verifyResponse.ok) {
            window.location.href = '/admin-login.html';
            return;
        }

        // Get initial dashboard data
        const dashboardResponse = await fetch('/api/admin/claims', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!dashboardResponse.ok) {
            console.error('Dashboard response not ok:', await dashboardResponse.text());
            throw new Error('Failed to fetch dashboard data');
        }

        const data = await dashboardResponse.json();
        console.log('Fetched claims data:', data);

        // Update statistics
        const stats = {
            total: data.length,
            pending: data.filter(claim => claim.status.toUpperCase() === 'PENDING').length,
            approved: data.filter(claim => claim.status.toUpperCase() === 'APPROVED').length,
            rejected: data.filter(claim => claim.status.toUpperCase() === 'REJECTED').length
        };
        
        document.getElementById('totalClaims').textContent = stats.total;
        document.getElementById('pendingClaims').textContent = stats.pending;
        document.getElementById('approvedClaims').textContent = stats.approved;
        document.getElementById('rejectedClaims').textContent = stats.rejected;

        // Verify the claims container exists
        const claimsContainer = document.getElementById('claimsContainer');
        if (!claimsContainer) {
            throw new Error('Claims container not found in the DOM');
        }

        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            throw new Error('Invalid data format');
        }

        displayClaims(data);

        // Setup search functionality
        document.getElementById('searchInput').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredClaims = data.filter(claim => 
                claim.name.toLowerCase().includes(searchTerm) ||
                claim.email.toLowerCase().includes(searchTerm) ||
                claim.description.toLowerCase().includes(searchTerm)
            );
            displayClaims(filteredClaims);
        });

        // Setup status filter
        document.getElementById('statusFilter').addEventListener('change', function(e) {
            const status = e.target.value;
            const filteredClaims = status === 'all' 
                ? data 
                : data.filter(claim => claim.status.toUpperCase() === status.toUpperCase());
            displayClaims(filteredClaims);
        });

        // Setup date filter
        document.getElementById('dateFilter').addEventListener('change', function(e) {
            const date = e.target.value;
            const filteredClaims = data.filter(claim => 
                claim.moveDate.split('T')[0] === date
            );
            displayClaims(filteredClaims);
        });

    } catch (error) {
        console.error('Error:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <h3>Error Loading Data</h3>
            <p>${error.message || 'Failed to load dashboard data'}</p>
        `;
        document.getElementById('claimsContainer').appendChild(errorMessage);
    }
});

function displayClaims(claims) {
    const claimsContainer = document.getElementById('claimsContainer');
    console.log('Displaying claims:', claims); // Debug log
    
    if (!claims || claims.length === 0) {
        console.log('No claims to display'); // Debug log
        claimsContainer.innerHTML = '<p class="no-claims">No claims found</p>';
        return;
    }

    claimsContainer.innerHTML = claims.map(claim => `
        <div class="claim-card" data-status="${claim.status.toUpperCase()}">
            <div class="claim-header">
                <h3>${claim.name}</h3>
                <span class="status-badge ${claim.status.toUpperCase()}">${claim.status}</span>
            </div>
            <div class="claim-details">
                <p><strong>Email:</strong> ${claim.email}</p>
                <p><strong>Phone:</strong> ${claim.phone}</p>
                <p><strong>Move Date:</strong> ${new Date(claim.moveDate).toLocaleDateString()}</p>
                <p><strong>Item Type:</strong> ${claim.itemType}</p>
                <p><strong>Weight:</strong> ${claim.itemWeight} lbs</p>
                <p><strong>Issue Type:</strong> ${claim.damageType}</p>
                <p><strong>Submitted:</strong> ${new Date(claim.createdAt).toLocaleDateString()}</p>
            </div>
            <div class="claim-actions">
                <button onclick="viewDetails('${claim._id}')" class="btn-view">View Details</button>
                <select 
                    class="status-select" 
                    onchange="updateClaimStatus('${claim._id}', this.value)"
                    value="${claim.status}"
                >
                    <option value="PENDING" ${claim.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                    <option value="APPROVED" ${claim.status === 'APPROVED' ? 'selected' : ''}>Approved</option>
                    <option value="REJECTED" ${claim.status === 'REJECTED' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
        </div>
    `).join('');
}

async function viewDetails(claimId) {
    try {
        const response = await fetch(`/api/admin/claims/${claimId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch claim details');
        }

        const claim = await response.json();

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Claim Details</h2>
                <div class="claim-details">
                    <p><strong>Name:</strong> ${claim.name}</p>
                    <p><strong>Email:</strong> ${claim.email}</p>
                    <p><strong>Phone:</strong> ${claim.phone}</p>
                    <p><strong>Move Date:</strong> ${new Date(claim.moveDate).toLocaleDateString()}</p>
                    <p><strong>Item Type:</strong> ${claim.itemType}</p>
                    <p><strong>Item Weight:</strong> ${claim.itemWeight} lbs</p>
                    <p><strong>Damage Type:</strong> ${claim.damageType}</p>
                    <p><strong>Description:</strong> ${claim.description}</p>
                    ${claim.status === 'REJECTED' && claim.rejectionReason ? `
                    <div style="background: #fff5f5; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #dc2626;"><strong>Reason for Rejection:</strong></p>
                        <p style="margin: 10px 0 0 0; color: #4b5563;">${claim.rejectionReason}</p>
                    </div>
                    ` : ''}
                    ${claim.additionalInfo ? `<p><strong>Additional Info:</strong> ${claim.additionalInfo}</p>` : ''}
                    ${claim.images && claim.images.length > 0 ? `
                        <div class="claim-images">
                            <h3>Images</h3>
                            ${claim.images.map(image => `
                                <img 
                                    src="${image.startsWith('/') ? image : '/uploads/' + image}" 
                                    alt="Claim Image" 
                                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22>No Image</text></svg>';"
                                    style="max-width: 300px; height: auto;"
                                >
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal when clicking the X or outside the modal
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => modal.remove();
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        };
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to fetch claim details');
    }
}

async function updateClaimStatus(claimId, newStatus) {
    // If status is REJECTED, show reason popup
    if (newStatus === 'REJECTED') {
        const reason = await showReasonPopup();
        if (!reason) {
            // If admin cancels, reset the select to previous value
            fetchDashboardData();
            return;
        }
        return updateClaimWithReason(claimId, newStatus, reason);
    }

    // For other statuses, proceed normally
    return updateClaimWithReason(claimId, newStatus);
}

function showReasonPopup() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3>Rejection Reason</h3>
                <p>Please provide a reason for rejecting this claim:</p>
                <textarea 
                    id="rejectionReason" 
                    rows="4" 
                    style="width: 100%; margin: 10px 0; padding: 8px;"
                    placeholder="Enter reason for rejection..."
                ></textarea>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-submit">Submit</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const submitBtn = modal.querySelector('.btn-submit');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const textarea = modal.querySelector('#rejectionReason');

        submitBtn.onclick = () => {
            const reason = textarea.value.trim();
            if (!reason) {
                alert('Please provide a reason for rejection');
                return;
            }
            modal.remove();
            resolve(reason);
        };

        cancelBtn.onclick = () => {
            modal.remove();
            resolve(null);
        };
    });
}

async function updateClaimWithReason(claimId, newStatus, reason = '') {
    try {
        console.log('Sending update request:', {
            claimId,
            newStatus,
            reason
        });
        
        const response = await fetch(`/api/admin/claims/${claimId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status: newStatus, reason }),
            credentials: 'include'
        });

        const responseData = await response.text();
        console.log('Server response:', responseData);

        if (!response.ok) {
            throw new Error(`Failed to update status: ${responseData}`);
        }

        const data = responseData ? JSON.parse(responseData) : {};
        
        // Show success notification
        showNotification('Status updated and notification email sent to customer', 'success');
        
        // Refresh the claims display
        fetchDashboardData();
    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}

// Add notification function
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Add fetchDashboardData function
async function fetchDashboardData() {
    try {
        const dashboardResponse = await fetch('/api/admin/claims', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!dashboardResponse.ok) {
            throw new Error('Failed to fetch dashboard data');
        }

        const data = await dashboardResponse.json();
        
        // Update statistics
        const stats = {
            total: data.length,
            pending: data.filter(claim => claim.status.toUpperCase() === 'PENDING').length,
            approved: data.filter(claim => claim.status.toUpperCase() === 'APPROVED').length,
            rejected: data.filter(claim => claim.status.toUpperCase() === 'REJECTED').length
        };
        
        document.getElementById('totalClaims').textContent = stats.total;
        document.getElementById('pendingClaims').textContent = stats.pending;
        document.getElementById('approvedClaims').textContent = stats.approved;
        document.getElementById('rejectedClaims').textContent = stats.rejected;
        
        // Update the claims display
        displayClaims(data);
    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to refresh dashboard data', 'error');
    }
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Clear any stored tokens/data
            localStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminToken');
            
            // Redirect to admin login page
            window.location.href = '/admin';
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Logout failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Failed to logout. Please try again.');
    }
});