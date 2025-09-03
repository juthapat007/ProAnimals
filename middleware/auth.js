// middleware/auth.js
export function requireLogin(req, res, next) {
  if (!req.session || !req.session.user_email) {
    return res.redirect('/login');
  }
  next();
}
