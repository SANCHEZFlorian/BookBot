import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { searchBook } from '../../services/bookApiService.js';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('lc')
        .setDescription('Gérer les Lectures Communes (LC)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcmd => 
            subcmd.setName('lancer')
                  .setDescription('Lancer une nouvelle Lecture Commune')
                  .addStringOption(opt => opt.setName('livre').setDescription('Titre du livre').setRequired(true))
        ),
        
    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'lancer') {
            await interaction.deferReply({ ephemeral: true });
            const query = interaction.options.getString('livre');
            const results = await searchBook(query);
            
            if (!results || results.length === 0) {
                return interaction.editReply({ embeds: [createErrorEmbed(`Aucun livre trouvé pour "${query}".`)] });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_lc_book')
                .setPlaceholder('Sélectionnez le livre pour la LC')
                .addOptions(
                    results.map((b, i) => new StringSelectMenuOptionBuilder()
                        .setLabel(b.title.substring(0, 100))
                        .setDescription(b.author ? `Par ${b.author.substring(0, 50)}` : 'Auteur inconnu')
                        .setValue(`lc_book_${i}`)
                    )
                );

            interaction.client.lcSearchResults = interaction.client.lcSearchResults || new Map();
            interaction.client.lcSearchResults.set(interaction.user.id, results);

            const embed = createBaseEmbed().setTitle(`📖 Lancer une Lecture Commune`).setDescription('Sélectionnez le livre correct :');
            await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        }
    },
};
