# Native authentication for Docker self-hosting

`AUTH_MODE=selfhosted_auth` enables OpenSEO's native email/password sign-in
without enabling the commercial hosted billing, analytics, or email services.

## First owner bootstrap

Set these values on the first deployment:

```env
AUTH_MODE=selfhosted_auth
BETTER_AUTH_URL=https://seo.example.com
BETTER_AUTH_SECRET=<random value, at least 32 characters>
BYPASS_EMAIL_VERIFICATION=true
INITIAL_OWNER_EMAIL=owner@example.com
INITIAL_ORGANIZATION_NAME=Example
SETUP_TOKEN=<random value, at least 32 characters>
```

Generate each secret independently:

```sh
openssl rand -base64 48
```

Open the setup URL once and create the configured owner account:

```text
https://seo.example.com/sign-up?setup_token=<SETUP_TOKEN>
```

The server accepts bootstrap registration only when both the setup token and
email match the configured values. Other registration attempts fail closed.

After the owner can sign in, remove `SETUP_TOKEN`, set the following value, and
recreate the container:

```env
SELFHOST_SIGNUP_DISABLED=true
```

Keep `BETTER_AUTH_SECRET` stable. Changing it invalidates sessions and may make
encrypted integration credentials unreadable.

## Reverse proxy

Forward HTTPS traffic to the container's HTTP port (3001 by default), and set
`BETTER_AUTH_URL` to the exact public HTTPS origin. Do not include a trailing
slash or path.

## Current scope

The initial self-hosted authentication mode provides native sessions and a
locked owner bootstrap. Invite delivery, password-reset email, and granular
workspace roles require a configured transactional email provider and are
implemented separately from the commercial Loops integration.
