import { useEffect, useState } from 'react';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const initialProduct = { product_name: '', description: '', price: '', quantity: '' };

function readToken(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

async function apiRequest(path, { token = readToken('lab6_access_token'), ...options } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshToken = readToken('lab6_refresh_token');
    if (refreshToken) {
      const refreshed = await fetch(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const tokens = await refreshed.json().catch(() => ({}));
      if (refreshed.ok && tokens.tokens) {
        localStorage.setItem('lab6_access_token', tokens.tokens.access_token);
        localStorage.setItem('lab6_refresh_token', tokens.tokens.refresh_token);
        return apiRequest(path, { ...options, token: tokens.tokens.access_token });
      }
    }
  }

  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        token: '',
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('lab6_access_token', result.tokens.access_token);
      localStorage.setItem('lab6_refresh_token', result.tokens.refresh_token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-glyph">P</span><span>PRODUCT MANAGEMENT</span></div>
        <p className="login-overline">LABORATORY EXERCISE NO. 6</p>
        <h1>Welcome back</h1>
        <p className="login-subtitle">Sign in to manage your product catalog.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        <form onSubmit={submit} className="login-form">
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Enter your username" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" />
          <button className="button primary login-button" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        </form>
        <div className="login-foot"><span className="secure-dot" /> Protected by LavaLust API authentication</div>
      </section>
    </main>
  );
}

function Products({ onLogout }) {
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState(initialProduct);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    try {
      const result = await apiRequest('/api/products');
      setProducts(result.data || []);
      setError('');
    } catch (err) {
      setError(err.message);
      if (/unauthorized|expired|revoked/i.test(err.message)) onLogout(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  function updateField(event) {
    setProduct((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const editing = editingId !== null;
    try {
      await apiRequest(editing ? `/api/products/${editingId}` : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...product,
          price: Number(product.price),
          quantity: Number(product.quantity),
        }),
      });
      setProduct(initialProduct);
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editProduct(item) {
    setEditingId(item.id);
    setProduct({
      product_name: item.product_name,
      description: item.description || '',
      price: String(item.price),
      quantity: String(item.quantity),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setProduct(initialProduct);
  }

  async function deleteProduct(item) {
    if (!window.confirm(`Delete “${item.product_name}”? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/products/${item.id}`, { method: 'DELETE' });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="products-page">
      <header className="product-header">
        <div className="product-header-inner">
          <div className="product-brand"><span className="brand-glyph">P</span><span>Product Management</span></div>
          <button className="button logout-button" onClick={() => onLogout(true)}>Logout</button>
        </div>
      </header>

      <div className="content-wrap">
        <div className="page-title-row">
          <div><p className="section-overline">YOUR WORKSPACE</p><h1>Product list</h1></div>
          <div className="item-count">{products.length} {products.length === 1 ? 'product' : 'products'}</div>
        </div>

        {error && <p className="notice error" role="alert">{error}</p>}

        <form className="product-form-card" onSubmit={saveProduct}>
          <div className="product-fields">
            <label className="sr-only" htmlFor="product_name">Product name</label>
            <input id="product_name" name="product_name" value={product.product_name} onChange={updateField} maxLength={100} required placeholder="Product name" />
            <label className="sr-only" htmlFor="description">Description</label>
            <input id="description" name="description" value={product.description} onChange={updateField} placeholder="Description" />
            <label className="sr-only" htmlFor="price">Price</label>
            <input id="price" name="price" type="number" min="0" step="0.01" value={product.price} onChange={updateField} required placeholder="Price" />
            <label className="sr-only" htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min="0" step="1" value={product.quantity} onChange={updateField} required placeholder="Quantity" />
          </div>
          <div className="form-buttons">
            {editingId !== null && <button type="button" className="button cancel-button" onClick={cancelEdit}>Cancel</button>}
            <button className="button primary" disabled={busy}>{busy ? 'Saving…' : editingId !== null ? 'Update' : 'Add'}</button>
          </div>
        </form>

        <section className="table-card" aria-label="Products">
          <div className="table-scroll">
            <table>
              <thead><tr><th className="id-col">ID</th><th>Name</th><th>Description</th><th>Price</th><th>Qty</th><th className="actions-col">Actions</th></tr></thead>
              <tbody>
                {products.map((item) => (
                  <tr key={item.id}>
                    <td className="id-cell">{item.id}</td>
                    <td className="product-name-cell">{item.product_name}</td>
                    <td className="description-cell">{item.description || '—'}</td>
                    <td className="price-cell">{money(item.price)}</td>
                    <td>{item.quantity}</td>
                    <td><div className="row-actions"><button className="button edit-button" onClick={() => editProduct(item)}>Edit</button><button className="button delete-button" onClick={() => deleteProduct(item)}>Delete</button></div></td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td className="empty-cell" colSpan="6">Your catalog is empty. Add your first product above.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="page-footer">Product data is managed securely through the LavaLust API.</footer>
      </div>
    </main>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(readToken('lab6_access_token')));

  useEffect(() => {
    if (loggedIn) {
      if (window.location.pathname !== '/products') window.history.replaceState({}, '', '/products');
    } else if (window.location.pathname !== '/login') {
      window.history.replaceState({}, '', '/login');
    }
  }, [loggedIn]);

  async function logout(revoke = true) {
    if (revoke && readToken('lab6_access_token')) {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: readToken('lab6_refresh_token') }),
        });
      } catch { /* Clear the local session even when the API is unavailable. */ }
    }
    localStorage.removeItem('lab6_access_token');
    localStorage.removeItem('lab6_refresh_token');
    window.history.replaceState({}, '', '/login');
    setLoggedIn(false);
  }

  return loggedIn ? <Products onLogout={logout} /> : <Login onLogin={() => { window.history.replaceState({}, '', '/products'); setLoggedIn(true); }} />;
}
