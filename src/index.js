require('dotenv').config();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const {
  DISCORD_TOKEN,
  REVIEW_CHANNEL_ID,
} = process.env;

if (!DISCORD_TOKEN || !REVIEW_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or REVIEW_CHANNEL_ID in .env');
  process.exit(1);
}

const BRAND = {
  name: 'Doobs Uploading Services',
  color: 0xff0000,
  footer: 'Doobs Uploading Services • Reviews',
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function stars(count) {
  const rating = Number(count);
  return '⭐'.repeat(Math.max(1, Math.min(5, rating)));
}

function reviewPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle('⭐ Leave a Review')
    .setDescription(
      [
        'Thank you for choosing **Doobs Uploading Services**!',
        '',
        'Click the button below, select your star rating, and tell us what you purchased.',
        '',
        '**Please only leave a review after your service has been completed.**',
      ].join('\n')
    )
    .setFooter({ text: BRAND.footer });
}

function reviewPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('review:start')
      .setLabel('Leave a Review')
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Danger)
  );
}

function starButtons() {
  return new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map(num =>
      new ButtonBuilder()
        .setCustomId(`review:stars:${num}`)
        .setLabel(`${num}`)
        .setEmoji('⭐')
        .setStyle(num === 5 ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
}

function buildReviewModal(rating) {
  const modal = new ModalBuilder()
    .setCustomId(`review:modal:${rating}`)
    .setTitle(`Leave a ${rating}-Star Review`);

  const purchaseInput = new TextInputBuilder()
    .setCustomId('purchase')
    .setLabel('What did you purchase?')
    .setPlaceholder('Example: PC Upload, PC + Quest, Premium Package, Bundle, GoGoLoco')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true);

  const reviewInput = new TextInputBuilder()
    .setCustomId('review')
    .setLabel('Describe your experience')
    .setPlaceholder('Example: Fast, easy, helpful, and my avatar uploaded perfectly.')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(900)
    .setRequired(true);

  const recommendInput = new TextInputBuilder()
    .setCustomId('recommend')
    .setLabel('Would you recommend us?')
    .setPlaceholder('Yes / No')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(20)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(purchaseInput),
    new ActionRowBuilder().addComponents(reviewInput),
    new ActionRowBuilder().addComponents(recommendInput)
  );

  return modal;
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-reviews') {
        await interaction.reply({
          embeds: [reviewPanelEmbed()],
          components: [reviewPanelButtons()],
        });
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'review:start') {
        await interaction.reply({
          content: 'Select your rating:',
          components: [starButtons()],
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith('review:stars:')) {
        const rating = interaction.customId.split(':')[2];
        await interaction.showModal(buildReviewModal(rating));
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith('review:modal:')) return;

      const rating = interaction.customId.split(':')[2];
      const purchase = interaction.fields.getTextInputValue('purchase').trim();
      const review = interaction.fields.getTextInputValue('review').trim();
      const recommend = interaction.fields.getTextInputValue('recommend').trim();

      const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL_ID);

      if (!reviewChannel || reviewChannel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'Review channel could not be found. Please contact staff.',
          ephemeral: true,
        });
        return;
      }

      const publicEmbed = new EmbedBuilder()
        .setColor(BRAND.color)
        .setTitle('⭐ New Customer Review')
        .addFields(
          { name: 'Rating', value: `${stars(rating)} (${rating}/5)`, inline: true },
          { name: 'Purchased', value: purchase, inline: true },
          { name: 'Recommended', value: recommend, inline: true },
          { name: 'Review', value: review, inline: false },
        )
        .setFooter({ text: `Submitted by ${interaction.user.tag}` })
        .setTimestamp();

      await reviewChannel.send({ embeds: [publicEmbed] });

      await interaction.reply({
        content: 'Thank you! Your review has been posted. ⭐',
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error(error);

    const message = {
      content: 'Something went wrong while processing this review. Please contact staff.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => null);
    } else {
      await interaction.reply(message).catch(() => null);
    }
  }
});

client.login(DISCORD_TOKEN);
