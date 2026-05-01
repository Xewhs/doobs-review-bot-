import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} from 'discord.js';

const required = ['DISCORD_TOKEN', 'REVIEW_CHANNEL_ID'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env / Railway Variables`);
}

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  return false;
}

function parseDuration(input) {
  const match = String(input).trim().toLowerCase().match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = value * multipliers[unit];
  if (ms < 1000 || ms > 28 * 24 * 60 * 60 * 1000) return null;
  return ms;
}

async function logMod(guild, embed) {
  if (!MOD_LOG_CHANNEL_ID) return;
  const channel = await guild.channels.fetch(MOD_LOG_CHANNEL_ID).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => null);
}

function modEmbed(title, fields) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0xff1f1f)
    .addFields(fields)
    .setTimestamp();
}

function reviewPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle('⭐ Leave a Review')
    .setDescription('Thank you for choosing **Doobs Uploading Services**!\n\nClick the button below to leave a review. Your feedback helps future customers know what to expect.')
    .setColor(0xff1f1f)
    .setFooter({ text: 'Doobs Uploading Services' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('review_start')
      .setLabel('Leave a Review')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⭐')
  );

  return { embeds: [embed], components: [row] };
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'setup-reviews') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff only.', ephemeral: true });
        await interaction.channel.send(reviewPanelPayload());
        return interaction.reply({ content: 'Review panel posted.', ephemeral: true });
      }

      if (['timeout','untimeout','kick','ban','unban','purge','warn','request-review'].includes(commandName) && !isStaff(interaction.member)) {
        return interaction.reply({ content: 'Staff only.', ephemeral: true });
      }

      if (commandName === 'timeout') {
        const user = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const ms = parseDuration(duration);
        if (!ms) return interaction.reply({ content: 'Invalid duration. Use examples like `10m`, `2h`, or `1d`. Max is 28d.', ephemeral: true });
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
        await member.timeout(ms, reason);
        await interaction.reply({ content: `Timed out ${user.tag} for ${duration}.`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('User Timed Out', [
          { name: 'User', value: `${user.tag} (${user.id})` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Duration', value: duration },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'untimeout') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
        await member.timeout(null, reason);
        await interaction.reply({ content: `Removed timeout from ${user.tag}.`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('Timeout Removed', [
          { name: 'User', value: `${user.tag} (${user.id})` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'kick') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
        await member.kick(reason);
        await interaction.reply({ content: `Kicked ${user.tag}.`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('User Kicked', [
          { name: 'User', value: `${user.tag} (${user.id})` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'ban') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('delete_days') ?? 0;
        await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: days * 86400 });
        await interaction.reply({ content: `Banned ${user.tag}.`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('User Banned', [
          { name: 'User', value: `${user.tag} (${user.id})` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Deleted History', value: `${days} day(s)` },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'unban') {
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        await interaction.guild.members.unban(userId, reason);
        await interaction.reply({ content: `Unbanned user ID ${userId}.`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('User Unbanned', [
          { name: 'User ID', value: userId },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'purge') {
        const amount = interaction.options.getInteger('amount', true);
        if (!interaction.channel || interaction.channel.type === ChannelType.DM) return interaction.reply({ content: 'Run this in a server channel.', ephemeral: true });
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `Deleted ${deleted.size} message(s).`, ephemeral: true });
        return logMod(interaction.guild, modEmbed('Messages Purged', [
          { name: 'Channel', value: `${interaction.channel}` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Amount', value: `${deleted.size}` }
        ]));
      }

      if (commandName === 'warn') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        await interaction.reply({ content: `Warned ${user.tag}.`, ephemeral: true });
        await user.send(`You received a warning in **${interaction.guild.name}**.\nReason: ${reason}`).catch(() => null);
        return logMod(interaction.guild, modEmbed('User Warned', [
          { name: 'User', value: `${user.tag} (${user.id})` },
          { name: 'Staff', value: `${interaction.user.tag}` },
          { name: 'Reason', value: reason }
        ]));
      }

      if (commandName === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const embed = new EmbedBuilder()
          .setTitle('User Info')
          .setColor(0xff1f1f)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})` },
            { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
            { name: 'Joined Server', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Unknown' },
            { name: 'Roles', value: member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `${r}`).join(', ').slice(0, 1000) || 'None' : 'Unknown' }
          );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (commandName === 'request-review') {
        const user = interaction.options.getUser('user', true);
        await user.send({
          content: `Thanks for using **Doobs Uploading Services**! If everything looks good, I’d really appreciate a review.`,
          ...reviewPanelPayload()
        }).catch(async () => {
          return interaction.reply({ content: 'Could not DM that user. Their DMs may be closed.', ephemeral: true });
        });
        if (!interaction.replied) await interaction.reply({ content: `Review request sent to ${user.tag}.`, ephemeral: true });
      }
    }

    if (interaction.isButton() && interaction.customId === 'review_start') {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('review_stars')
          .setPlaceholder('Select your star rating')
          .addOptions([
            { label: '5 Stars', value: '5', emoji: '⭐' },
            { label: '4 Stars', value: '4', emoji: '⭐' },
            { label: '3 Stars', value: '3', emoji: '⭐' },
            { label: '2 Stars', value: '2', emoji: '⭐' },
            { label: '1 Star', value: '1', emoji: '⭐' }
          ])
      );
      return interaction.reply({ content: 'Select your rating:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'review_stars') {
      const stars = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`review_modal_${stars}`)
        .setTitle('Leave a Review');

      const purchased = new TextInputBuilder()
        .setCustomId('purchased')
        .setLabel('What did you purchase?')
        .setPlaceholder('PC Upload, PC + Quest, Premium Package, Bundle...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const description = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Describe your experience')
        .setPlaceholder('Tell us how it went...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const recommend = new TextInputBuilder()
        .setCustomId('recommend')
        .setLabel('Would you recommend us?')
        .setPlaceholder('Yes / No')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      modal.addComponents(
        new ActionRowBuilder().addComponents(purchased),
        new ActionRowBuilder().addComponents(description),
        new ActionRowBuilder().addComponents(recommend)
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('review_modal_')) {
      const stars = interaction.customId.replace('review_modal_', '');
      const purchased = interaction.fields.getTextInputValue('purchased');
      const description = interaction.fields.getTextInputValue('description');
      const recommend = interaction.fields.getTextInputValue('recommend');

      const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
      if (!reviewChannel?.isTextBased()) return interaction.reply({ content: 'Review channel is not configured correctly.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('⭐ New Customer Review')
        .setColor(0xff1f1f)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Rating', value: '⭐'.repeat(Number(stars)) },
          { name: 'Purchased', value: purchased },
          { name: 'Review', value: description },
          { name: 'Recommended', value: recommend },
          { name: 'Customer', value: `${interaction.user}` }
        )
        .setFooter({ text: 'Doobs Uploading Services' })
        .setTimestamp();

      await reviewChannel.send({ embeds: [embed] });
      return interaction.reply({ content: 'Thank you! Your review has been submitted.', ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      const msg = 'Something went wrong. Check bot permissions and Railway logs.';
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: msg, ephemeral: true }).catch(() => null);
      return interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
