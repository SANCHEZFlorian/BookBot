import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { searchBook } from '../../services/bookApiService.js';
import db from '../../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('livre')
        .setDescription('Commandes liées aux livres')
        .addSubcommand(subcmd => 
            subcmd.setName('chercher')
                  .setDescription('Recherche un livre sur internet')
                  .addStringOption(opt => opt.setName('titre').setDescription('Titre, auteur...').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('stream')
                  .setDescription('Définit le livre actuellement affiché sur votre stream (Overlay OBS)')
        ),

    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'chercher') {
            await handleSearch(interaction, interaction.options.getString('titre'));
        } else if (subcmd === 'stream') {
            await handleSetStreamBook(interaction);
        }
    }
};

async function handleSearch(interaction, query) {
    await interaction.deferReply();
    const results = await searchBook(query);
    if (!results || results.length === 0) return interaction.editReply({ embeds: [createErrorEmbed('Aucun résultat.')] });

    if (results.length === 1) {
        const payload = await createBookEmbed(results[0], interaction.user);
        return interaction.editReply(payload);
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_book_search')
        .setPlaceholder('Sélectionnez le bon livre...')
        .addOptions(results.map((b, i) => new StringSelectMenuOptionBuilder().setLabel(b.title.substring(0, 100)).setValue(`book_search_${i}`)));

    interaction.client.bookSearchResults = interaction.client.bookSearchResults || new Map();
    interaction.client.bookSearchResults.set(interaction.user.id, results);

    await interaction.editReply({ 
        embeds: [createBaseEmbed().setTitle(`🔍 Résultats : ${query}`)], 
        components: [new ActionRowBuilder().addComponents(selectMenu)] 
    });
}

export async function createBookEmbed(book, user) {
    const embed = createBaseEmbed()
        .setAuthor({ name: `Recherche par ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTitle(book.title.substring(0, 256))
        .addFields(
            { name: 'Auteur', value: book.author || 'Inconnu', inline: true },
            { name: 'Pages', value: book.pageCount ? `${book.pageCount}` : 'Inconnu', inline: true }
        );

    // Récupérer la moyenne des avis
    try {
        const [reviews] = await db.query(`SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM book_reviews WHERE google_book_id = ?`, [book.id]);
        if (reviews[0].count > 0) {
            const avg = Number(reviews[0].avg_rating).toFixed(1);
            embed.addFields({ name: 'Avis des Lecteurs', value: `⭐ **${avg}/5** (${reviews[0].count} avis)`, inline: false });
        }
    } catch(e) {}

    let description = book.description || 'Aucun résumé disponible.';
    if (description.length > 1000) description = description.substring(0, 997) + '...';
    embed.setDescription(description);
    if (book.coverUrl) embed.setThumbnail(book.coverUrl);
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_voir_avis_${book.id}`)
            .setLabel('Voir les avis')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌟')
    );
    
    return { embeds: [embed], components: [row] };
}

export async function handleSetStreamBook(interaction, isUpdate = false) {
    if (!isUpdate && !interaction.deferred) await interaction.deferReply({ ephemeral: true });
    
    try {
        const [rows] = await db.query(
            `SELECT id, title, author, is_current FROM books WHERE user_id = ? AND status IN ('to_read', 'reading') ORDER BY added_at DESC LIMIT 25`,
            [interaction.user.id]
        );

        if (rows.length === 0) {
            const err = createErrorEmbed('Votre PAL est vide ou tout est terminé.');
            return isUpdate ? interaction.update({ embeds: [err] }) : interaction.editReply({ embeds: [err] });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_stream_book')
            .setPlaceholder('Livre affiché sur le stream...')
            .addOptions(rows.map(b => new StringSelectMenuOptionBuilder()
                .setLabel(b.title.substring(0, 90) + (b.is_current ? ' (Actuel)' : ''))
                .setValue(`stream_set_${b.id}`)
            ));

        const embed = createBaseEmbed().setTitle('🎥 Livre Stream').setDescription('Sélectionnez le livre à afficher sur l\'Overlay OBS.');
        const components = [new ActionRowBuilder().addComponents(selectMenu)];
        
        isUpdate ? await interaction.update({ embeds: [embed], components }) : await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
        console.error(err);
    }
}
