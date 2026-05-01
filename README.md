# Doobs Review Bot

A custom Discord review bot for Doobs Uploading Services.

## What it does

- Posts a review panel with `/setup-reviews`
- Customer clicks **Leave a Review**
- Customer selects 1-5 stars
- Bot opens a popup form
- Customer enters:
  - What they purchased
  - Their review description
  - Whether they recommend the service
- Bot posts a clean embed into your reviews channel

## Requirements

- Node.js 22.12.0 or newer
- A Discord bot application
- Bot permissions:
  - Send Messages
  - Embed Links
  - Use Slash Commands
  - Read/View Channels

## Setup

1. Install Node.js.
2. Create a Discord application and bot in the Discord Developer Portal.
3. Copy `.env.example` and rename it to `.env`.
4. Fill out your `.env` file:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_server_id
REVIEW_CHANNEL_ID=your_reviews_channel_id
```

5. Install packages:

```bash
npm install
```

6. Deploy slash commands:

```bash
npm run deploy
```

7. Start the bot:

```bash
npm start
```

8. In Discord, go to the channel where you want the review panel and run:

```txt
/setup-reviews
```

## Notes

Keep your bot token private. Never post it in Discord, GitHub, screenshots, or public chats.
