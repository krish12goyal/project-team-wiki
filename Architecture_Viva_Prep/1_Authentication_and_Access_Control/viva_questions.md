# Viva / Interview Questions: Authentication & Access Control

## Basic Level
1. **Q:** What is the primary method of authentication used in this application?
   * **A:** The system uses JSON Web Tokens (JWT) for stateless authentication.
2. **Q:** How and where is the token transmitted from the frontend to the backend?
   * **A:** It is sent in the HTTP Headers under the `Authorization` key, formatted as `Bearer <token>`.
3. **Q:** Why do we use JWTs instead of traditional Express session cookies?
   * **A:** JWTs are stateless, meaning the backend doesn't need to store session IDs in memory or a database. They are lightweight and easy to verify via a secret key.

## Intermediate Level
4. **Q:** We have two `authMiddleware.js` files (one in `middleware/` and one in `utils/`). What is the fundamental security difference between them?
   * **A:** The `utils` version only checks if the JWT signature is valid cryptographically. The `middleware` version verifies the token AND queries the MongoDB database (`User.findById`) to ensure the user hasn't been deleted or banned (checking `user.isActive`).
5. **Q:** What is the performance trade-off in querying the database inside the auth middleware?
   * **A:** Checking the database adds latency (I/O time) to every single protected route. However, it provides immediate block capability if an admin disables an account. Pure JWT verification is much faster but relies completely on token expiration time.

## Advanced Level
6. **Q:** How does the `authorize(...roles)` function work dynamically?
   * **A:** It is a higher-order function (a function that returns a middleware function) placed after the token verification. It checks if the `req.user.role` (which was attached by the previous middleware) exists in the allowed `roles` array.
7. **Q:** If an attacker steals a user's JWT from `localStorage`, what can they do, and how can the system defend against it?
   * **A:** They can impersonate the user until the token expires. Defenses include short expiration times (`1h`), implementing refresh tokens, or dynamically checking an active/revoked list in the database (like the `middleware` approach does).
