function LoginPage() {
  return (
    <main>
      <h1>Login</h1>

      <form>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit">Login</button>
      </form>
    </main>
  );
}

export default LoginPage;