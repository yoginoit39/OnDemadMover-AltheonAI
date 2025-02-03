document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const button = e.target.querySelector('button');
    
    try {
        button.classList.add('loading');
        
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Login failed');
        }

        // If login successful, redirect to dashboard
        window.location.href = '/admin/dashboard';
        
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Failed to login. Please try again.');
    } finally {
        button.classList.remove('loading');
    }
}); 