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
    <main className="login card">
      <div className="brand">
        <div className="mark">F</div>
        <div><div className="eyebrow">FORGE&nbsp; / &nbsp;INVENTORY</div><h1>Product Manager</h1></div>
      </div>
      <div className="login-intro">
        <div className="eyebrow">YOUR PRODUCT WORKSPACE</div>
        <h2>A clearer view of your inventory.</h2>
        <p className="muted">Sign in to manage products, stock, and pricing from one place.</p>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="username">Username</label><input className="input" id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Enter your username" /></div>
        <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" /></div>
        <button className="btn login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'}</button>
      </form>
      <div className="login-foot"><span className="status-dot" />SECURE ACCESS&nbsp; · &nbsp;LAVALUST</div>
    </main>
  );
}

function Products({ onLogout }) {
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState(initialProduct);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const totalUnits = products.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const stockValue = products.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);

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
      setFormOpen(false);
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
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setProduct(initialProduct);
    setFormOpen(false);
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
    <main className="shell">
      <header className="top">
        <div className="brand"><div className="mark">F</div><div><div className="eyebrow">FORGE&nbsp; / &nbsp;INVENTORY</div><h1>Product Manager</h1></div></div>
        <div className="header-actions">
          <span className="session-label"><span className="status-dot" />WORKSPACE ACTIVE</span>
          <button className="btn light logout" onClick={() => onLogout(true)}>Log out</button>
        </div>
      </header>

      <section className="toolbar"><div className="heading"><div className="eyebrow">PRODUCT MANAGEMENT&nbsp; / &nbsp;OVERVIEW</div><h2>Inventory, in focus.</h2><p>Manage your catalog and keep every detail in order.</p></div></section>

      {error && <p className="alert" role="alert">{error}</p>}

      <section className="stats" aria-label="Inventory summary">
        <article className="stat-card card"><span className="stat-label">TOTAL PRODUCTS</span><strong>{String(products.length).padStart(2, '0')}</strong><span className="stat-note">Active catalog items</span></article>
        <article className="stat-card card"><span className="stat-label">UNITS IN STOCK</span><strong>{totalUnits.toLocaleString('en-PH')}</strong><span className="stat-note">Across all products</span></article>
        <article className="stat-card card stat-value"><span className="stat-label">STOCK VALUE</span><strong>{money(stockValue)}</strong><span className="stat-note">Based on current quantities</span></article>
      </section>

      <div className="layout">
        <section className="card table-card" aria-label="Products">
          <div className="table-heading"><div><div className="eyebrow">CATALOG</div><h3>Product list</h3></div><span className="count">{products.length} {products.length === 1 ? 'ITEM' : 'ITEMS'}</span></div>
          {products.length > 0 ? <div className="table-scroll"><table>
            <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Actions</th></tr></thead>
            <tbody>{products.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.product_name}</strong><div className="desc">{item.description || 'No description'}</div></td>
                <td>{money(item.price)}</td>
                <td>{Number(item.quantity).toLocaleString('en-PH')}</td>
                <td><div className="actions"><button className="btn light small" onClick={() => editProduct(item)}>Edit</button><button className="btn danger small" onClick={() => deleteProduct(item)}>Delete</button></div></td>
              </tr>
            ))}</tbody>
          </table></div> : <div className="empty"><div className="empty-mark">F</div><strong>Your catalog starts here</strong><p>Add a product to begin building your inventory.</p></div>}
        </section>

        <aside className="card form-card">
          {!formOpen ? <>
            <div className="form-kicker eyebrow">GET STARTED</div><h3>Build your catalog</h3><p className="form-copy">Add a product and keep your inventory organized.</p>
            <button className="btn" onClick={() => setFormOpen(true)}>Add a product</button>
          </> : <>
            <div className="form-kicker eyebrow">CATALOG DETAILS</div><h3>{editingId !== null ? 'Edit product' : 'Add a product'}</h3><p className="form-copy">Keep product details accurate and up to date.</p>
            <form onSubmit={saveProduct}>
              <div className="field"><label htmlFor="product_name">Product name</label><input className="input" id="product_name" name="product_name" value={product.product_name} onChange={updateField} maxLength={100} required placeholder="e.g. Leather weekender" /></div>
              <div className="field"><label htmlFor="description">Description</label><textarea className="input" id="description" name="description" value={product.description} onChange={updateField} placeholder="Materials, details, and notes" /></div>
              <div className="form-row">
                <div className="field"><label htmlFor="price">Price (PHP)</label><input className="input" id="price" name="price" type="number" min="0" step="0.01" value={product.price} onChange={updateField} required placeholder="0.00" /></div>
                <div className="field"><label htmlFor="quantity">Quantity</label><input className="input" id="quantity" name="quantity" type="number" min="0" step="1" value={product.quantity} onChange={updateField} required placeholder="0" /></div>
              </div>
              <div className="form-actions"><button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId !== null ? 'Update product' : 'Save product'}</button><button type="button" className="btn light" onClick={cancelEdit}>Cancel</button></div>
            </form>
          </>}
        </aside>
      </div>
      <p className="footer">SECURE INVENTORY WORKSPACE&nbsp; · &nbsp;PRODUCT DATA PROTECTED BY LAVALUST</p>
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
