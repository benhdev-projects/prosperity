import * as Sentry from '@sentry/node';
import { BaseCommandInteraction, CommandInteraction, Message } from 'discord.js';
import { ReplyToInteraction } from './MessageManager';

export const LogInteractionError = async (error: Error, interaction: CommandInteraction | BaseCommandInteraction): Promise<void> => {
  Sentry.setTag('guild_id', interaction.guild?.id);
  Sentry.setTag('bot_id', interaction.applicationId);
  Sentry.setTag('user_id', interaction.user.id);
  Sentry.setTag('command', interaction.commandName);
  const errorCode = Sentry.captureException(error);
  await ReplyToInteraction(interaction, `There was an error while executing this interaction!\nPlease provide the error code ${errorCode} to the support team`, true);
};

export const LogMessageError = (error: Error, message: Message): void => {
  Sentry.setTag('guild_id', message.guild?.id);
  Sentry.setTag('bot_id', message.applicationId);
  Sentry.setTag('user_id', message.author.id);
  Sentry.captureException(error);
};