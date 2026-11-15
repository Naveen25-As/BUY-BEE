export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-bee-gold">BUY BEE</p>
          <p className="mt-2 text-sm text-slate-600">
            Modern tech commerce with trusted checkout, fast delivery, and curated electronics.
          </p>
        </div>
        <div>
          <p className="font-semibold">Shop</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Smartphones</li>
            <li>Laptops</li>
            <li>Audio</li>
            <li>Wearables</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Support</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Order tracking</li>
            <li>Returns policy</li>
            <li>Secure payments</li>
            <li>Help center</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Newsletter</p>
          <p className="mt-2 text-sm text-slate-600">Get deals and product launches in your inbox.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="newsletter" className="sr-only">
              Email
            </label>
            <input id="newsletter" type="email" placeholder="Email address" className="input-field" />
            <button type="submit" className="btn-primary">
              Join
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} BUY BEE. All rights reserved.
      </div>
    </footer>
  );
}
