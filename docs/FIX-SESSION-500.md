# Fix: 500 Error on Start Session

**Cause:** The `products` table is empty. `call_sessions` has a foreign key to `products`, so inserting a session with `product_id=ground_up_construction` fails.

**Fix:** Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor):

```sql
INSERT INTO products (id, name, config) VALUES
  ('ground_up_construction', 'Ground Up Construction', '{"product_id":"ground_up_construction","product_name":"Ground Up Construction","eligibility":{"states_allowed":["FL","GA","TX"]},"required_fields":[]}'::jsonb),
  ('fix_and_flip', 'Fix & Flip', '{"product_id":"fix_and_flip","product_name":"Fix & Flip","eligibility":{"states_allowed":[]},"required_fields":[]}'::jsonb),
  ('rental_loans', 'Rental Loans', '{"product_id":"rental_loans","product_name":"Rental Loans","eligibility":{"states_allowed":[]},"required_fields":[]}'::jsonb),
  ('stabilized_bridge', 'Stabilized Bridge', '{"product_id":"stabilized_bridge","product_name":"Stabilized Bridge","eligibility":{"states_allowed":[]},"required_fields":[]}'::jsonb),
  ('mf_sbl_faq', 'MF SBL FAQ', '{"product_id":"mf_sbl_faq","product_name":"MF SBL FAQ","eligibility":{"states_allowed":[]},"required_fields":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
```

Or copy/paste the contents of `supabase/migrations/002_seed_products.sql`
