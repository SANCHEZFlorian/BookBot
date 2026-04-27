import { SlashCommandBuilder } from 'discord.js';
import { playRadio, stopMusic, getCurrentRadio } from '../../services/musicService.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('musique')
        .setDescription('Contrôle la musique du bot')
        .addSubcommand(subcmd => 
            subcmd.setName('jouer')
                  .setDescription('Lance une radio')
                  .addStringOption(opt => opt.setName('station').setDescription('Station').setRequired(true).addChoices(
                      { name: 'LoFi Girl / Chillhop', value: 'chillhop' },
                      { name: 'LoFi Beats', value: 'lofi' },
                      { name: 'Cosy Jazz', value: 'jazz' }
                  ))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('stopper')
                  .setDescription('Arrête la musique')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('actuelle')
                  .setDescription('Musique en cours')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('volume')
                  .setDescription('Comment changer le volume ?')
        ),

    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        const channel = interaction.member?.voice?.channel;
        
        if (subcmd === 'jouer') {
            await interaction.deferReply();
            if (!channel) return interaction.editReply({ embeds: [createErrorEmbed('Vous devez être dans un vocal.')] });
            const s = interaction.options.getString('station');
            await playRadio(interaction, s);
            const n = s==='lofi'?'LoFi Beats':s==='jazz'?'Cosy Jazz':'LoFi Girl / Chillhop';
            await interaction.editReply({ embeds: [createBaseEmbed().setTitle('🎵 Musique lancée').setDescription(`Station : ${n}\nSalon : <#${channel.id}>`).setThumbnail('https://i.imgur.com/8mX1B8D.gif')] });
        } else if (subcmd === 'stopper') {
            await interaction.deferReply();
            if (!channel) return interaction.editReply({ embeds: [createErrorEmbed('Vous devez être dans un vocal.')] });
            if (stopMusic(interaction.guildId)) await interaction.editReply({ embeds: [createSuccessEmbed('Musique arrêtée.')] });
            else await interaction.editReply({ content: 'Je ne joue pas de musique ici.' });
        } else if (subcmd === 'actuelle') {
            await interaction.deferReply({ ephemeral: true });
            const r = getCurrentRadio(interaction.guildId);
            if (!r) return interaction.editReply({ embeds: [createErrorEmbed('Rien en cours.')] });
            const n = r==='lofi'?'LoFi Beats':r==='jazz'?'Cosy Jazz':'LoFi Girl / Chillhop';
            await interaction.editReply({ embeds: [createBaseEmbed().setTitle('📻 Radio en cours').setDescription(`**Station :** ${n}`).setThumbnail('https://i.imgur.com/8mX1B8D.gif')] });
        } else if (subcmd === 'volume') {
            await interaction.reply({ embeds: [createBaseEmbed().setTitle('🔊 Volume').setDescription('Faites **clic droit** sur le bot dans le vocal pour baisser son volume.')], ephemeral: true });
        }
    }
};
