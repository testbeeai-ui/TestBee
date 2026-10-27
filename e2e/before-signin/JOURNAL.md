# Before sign-in checks

Signed-out coverage for the Edublast website. No account is created and no payment is sent.

Run from `Web`:

```
npm run test:e2e
```

Chrome opens on this machine. Each test saves a video and a trace under `e2e/before-signin/recordings/`. Those files are local only. Open a trace with:

```
npx playwright show-trace e2e/before-signin/recordings/<trace>.zip
```

## Landing

- Student headline, then the For Teachers switch.
- Join free goes to `/waitlist`.
- Apply as teacher goes to `/auth?role=teacher`.
- Watch demo stays on `/`.
- Header Sign in opens the waitlist notice. Escape closes it. Join Waitlist Now goes to `/waitlist`.
- Header Join Now goes to `/waitlist`.
- Header links: About Us, Features, News & Blogs, Ts & Cs, Edufundz, Pricing, Contact Us.
- Enter the Gyan ++ Wall sends a guest back to `/?next=/magic-wall`.
- Phone width: menu, Sign in notice, Join Now.

## Sign-in page

- Continue with Google and Sign up now both open the waitlist notice.
- `/auth?mode=signup` switches to Teacher and that Google button opens the same notice.
- `/auth-choice` and `/select-role` land on `/auth`.

## Closed pages

- `/home`, `/play`, and `/teacher-portal` return to the landing page with `next` set.

## Other public pages

- About, pricing (no checkout), contact category fields, news, terms, privacy, waitlist form, EduDeca class select, join code field, Razorpay demo amount, friend-invite notice.
