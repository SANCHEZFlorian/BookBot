import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Répond avec Pong! et affiche la latence du bot.'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Calcul du ping...', fetchReply: true });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = createSuccessEmbed('Pong ! 🏓')
            .addFields(
                { name: 'Latence du Bot', value: `${latency}ms`, inline: true },
                { name: 'Latence de l\'API Discord', value: `${apiLatency}ms`, inline: true }
            );

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
