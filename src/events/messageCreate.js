const { User, GuildUser, Guild, LevelRole } = require('../database/database');
const { getXpNeeded } = require('../utils/levelUtils');
const { reply, send } = require('../utils/messages');
const { Op } = require('sequelize');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		try {
			await User.upsert({
				id: message.author.id,
				username: message.author.username,
				discriminator: message.author.discriminator,
			});
			let gu = await GuildUser.findOne({ where: { userId: message.author.id, guildId: message.guild.id } });
			if (gu == null) {
				gu = await GuildUser.create({
					userId: message.author.id,
					guildId: message.guild.id,
					level: 0,
					xp: 0,
				});
			}

			gu.xp += Math.floor(Math.random() * (15 - 7 + 1) + 7);
			if (gu.xp > getXpNeeded(gu.level + 1)) {
				gu.level += 1;
				const newLevelRole = await LevelRole.findOne({ where: { level: gu.level, guildId: message.guild.id } });
				if (newLevelRole != null) {
					message.member.roles.add(newLevelRole.id.toString());
					const oldLevelRole = await LevelRole.findOne({ where: { level: { [Op.lt]: gu.level }, guildId: message.guild.id } });
					message.member.roles.remove(oldLevelRole.id.toString());
				}
				const guild = await Guild.findByPk(message.guild.id);
				switch (guild.notificationType) {
				case 'reply':
					await reply(message, `Congratulations ${message.author} you have ranked up to level ${gu.level}`);
					break;
				case 'channel': {
					const channel = await message.guild.channels.fetch(guild.notificationChannel);
					await send(channel, `Congratulations ${message.author} you have ranked up to level ${gu.level}`);
					break;
				}
				case 'dm':
					message.author.createDM().then((c) => {
						c.send(`Congratulations ${message.author} you have ranked up to level ${gu.level}`);
					});
					break;
				}
			}
			await gu.save();
		}
		catch (e) {
			console.log(e);
		}
	},
};