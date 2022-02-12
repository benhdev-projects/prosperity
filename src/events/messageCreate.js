const {
  User, GuildUser, Guild, LevelRole, IgnoredChannel, IgnoredRole, MessageLog,
} = require('@prosperitybot/database');
const { Op, fn } = require('sequelize');
const Sentry = require('@sentry/node');
const { getXpNeeded } = require('../utils/levelUtils');
const { reply, send } = require('../utils/messages');
const translationManager = require('../translations/translationsManager');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    const translations = await translationManager.get(message.guild.id, message.client);
    if (message.author.bot) return;

    try {
      await User.upsert({
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator,
      });

      const guild = await Guild.findByPk(message.guild.id);
      let gu = await GuildUser.findOne({
        where: {
          userId: message.author.id,
          guildId: message.guild.id,
        },
      });
      if (gu == null) {
        gu = await GuildUser.create({
          userId: message.author.id,
          guildId: message.guild.id,
          level: 0,
          xp: 0,
          lastXpMessageSent: fn('NOW'),
        });
      }

      if ((Date.now() - gu.lastXpMessageSent) / 1000 >= 60) {
        await MessageLog.create({ userId: message.author.id, guildId: message.guild.id });

        const ignoredChannel = await IgnoredChannel.findByPk(message.channel.id);
        const ignoredRole = await IgnoredRole.findAll({
          where: {
            id: message.member.roles.cache.map((mr) => mr.id),
          },
        });

        if (ignoredChannel == null && ignoredRole.length === 0) {
          gu.messageCount += 1;
          const xpToGive = Math.floor(Math.random() * (15 - 7 + 1) + 7) * guild.xpRate;
          gu.xp += xpToGive;
          gu.lastXpMessageSent = fn('NOW');
          if (gu.xp > getXpNeeded(gu.level + 1)) {
            gu.level += 1;
            const newLevelRole = await LevelRole.findOne({
              where: {
                level: gu.level,
                guildId: message.guild.id,
              },
            });
            if (newLevelRole != null) {
              message.member.roles.add(newLevelRole.id.toString(), 'User levelled up');
              if (guild.roleAssignType === 'single') {
                const oldLevelRole = await LevelRole.findOne({
                  where: {
                    level: { [Op.lt]: gu.level },
                    guildId: message.guild.id,
                  },
                });
                if (oldLevelRole != null) {
                  message.member.roles.remove(oldLevelRole.id.toString());
                }
              }
            }
            await gu.save();
            switch (guild.notificationType) {
              case 'reply':
                await reply(
                  message,
                  // eslint-disable-next-line max-len
                  translationManager.format(
                    translations.events.message_create.message_level_up_reply,
                    [['user', message.author], ['level', gu.level]],
                  ),
                );
                break;
              case 'channel': {
                const channel = await message.guild.channels.fetch(guild.notificationChannel);
                await send(
                  channel,
                  // eslint-disable-next-line max-len
                  translationManager.format(
                    translations.events.message_create.message_level_up_channel,
                    [['user', message.author], ['level', gu.level]],
                  ),
                );
                break;
              }
              case 'dm':
                message.author.createDM().then((c) => {
                  c.send(
                    // eslint-disable-next-line max-len
                    translationManager.format(
                      translations.events.message_create.message_level_up_dm,
                      [['user', message.author], ['level', gu.level]],
                    ),
                  );
                }).catch((e) => Sentry.captureException(e));
                break;
              default:
                break;
            }
          } else {
            await gu.save();
          }
        }
      }
    } catch (e) {
      Sentry.setTag('guild_id', message.guild.id);
      Sentry.setTag('bot_id', message.client.application.id);
      Sentry.captureException(e);
    }
  },
};
