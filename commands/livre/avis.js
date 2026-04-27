import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { searchBook } from '../../services/bookApiService.js';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('avis')
        .setDescription('Donnez votre avis sur un livre')
        .addSubcommand(subcmd => 
            subcmd.setName('donner')
                  .setDescription('Écrire une chronique sur un livre')
                  .addStringOption(opt => opt.setName('livre').setDescription('Titre du livre').setRequired(true))
        ),
        
    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'donner') {
            await interaction.deferReply({ ephemeral: true });
            const query = interaction.options.getString('livre');
            const results = await searchBook(query);
            
            if (!results || results.length === 0) {
                return interaction.editReply({ embeds: [createErrorEmbed(`Aucun livre trouvé pour "${query}".`)] });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_avis_book')
                .setPlaceholder('Quel livre souhaitez-vous critiquer ?')
                .addOptions(
                    results.map((b, i) => new StringSelectMenuOptionBuilder()
                        .setLabel(b.title.substring(0, 100))
                        .setDescription(b.author ? `Par ${b.author.substring(0, 50)}` : 'Auteur inconnu')
                        .setValue(`avis_book_${i}`)
                    )
                );

            interaction.client.avisSearchResults = interaction.client.avisSearchResults || new Map();
            interaction.client.avisSearchResults.set(interaction.user.id, results);

            const embed = createBaseEmbed().setTitle(`🌟 Donner un avis`).setDescription('Sélectionnez le livre correct :');
            await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        }
    },
};
