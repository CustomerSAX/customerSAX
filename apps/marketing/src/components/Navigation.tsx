export function Navigation() {
  return (
    <nav className="nav">
    <div className="shell nav-inner">
      <a className="brand" href="#top"><img className="brand-logo" src="brand/customerSAX-logo.svg" alt="customerSAX" /></a>
      <div className="nav-links"><a href="#platform">Platform</a><a href="#service">Customer service</a><a href="#workforce">Human + AI</a><a href="#usecases">Use cases</a><a href="#integrations">Integrations</a><a href="#enterprise">Enterprise</a></div>
      <div className="nav-actions"><a className="btn" href="#platform">Explore platform</a><a className="btn primary" href="#demo">Book a demo</a><button className="menu">☰</button></div>
    </div>
  </nav>
  );
}
