document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();
        
        if (data.token) {
            localStorage.setItem('adminToken', data.token);
            window.location.href = '/admin/dashboard';
        } else {
            throw new Error('No token received');
        }
    } catch (error) {
        console.error('Login error:', error);
        localStorage.removeItem('adminToken');
        alert('Login failed: ' + error.message);
    }
}); 