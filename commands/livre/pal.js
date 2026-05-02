import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { searchBook } from '../../services/bookApiService.js';
import db from '../../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export const command = {
    data: new SlashCommandBuilder()
        .setName('pal')
        .setDescription('Gestion complète de votre Pile à Lire')
        .addSubcommand(subcmd => 
            subcmd.setName('ajouter')
                  .setDescription('Ajouter un livre à votre PAL')
                  .addStringOption(opt => opt.setName('titre').setDescription('Titre, auteur ou ISBN').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('liste')
                  .setDescription('Affiche votre PAL')
                  .addUserOption(opt => opt.setName('membre').setDescription('Voir la PAL d\'un autre membre').setRequired(false))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('retirer')
                  .setDescription('Retire un livre de votre PAL')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('link')
                  .setDescription('Lier votre PAL (Livraddict ou autre) à votre profil')
                  .addStringOption(opt => opt.setName('url').setDescription('Lien vers votre PAL').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('import')
                  .setDescription('Importer des livres depuis votre PAL Livraddict')
                  .addStringOption(opt => opt.setName('url').setDescription('Lien de votre PAL Livraddict (doit finir par ?goto=pal)').setRequired(true))
        ),

    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'ajouter') {
            await handleAdd(interaction, interaction.options.getString('titre'));
        } else if (subcmd === 'liste') {
            const targetUser = interaction.options.getUser('membre') || interaction.user;
            await sendPalList(interaction, targetUser);
        } else if (subcmd === 'retirer') {
            await handleRemove(interaction);
        } else if (subcmd === 'link') {
            await handleLink(interaction);
        } else if (subcmd === 'import') {
            await handleImport(interaction);
        }
    }
};

// Logique exportée pour le menu global
export async function handleAdd(interaction, query) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

    const results = await searchBook(query);
    if (!results || results.length === 0) {
        return interaction.editReply({ embeds: [createErrorEmbed(`Aucun résultat pour "${query}".`)] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_pal_add')
        .setPlaceholder('Sélectionnez le livre à ajouter...')
        .addOptions(
            results.map((b, i) => new StringSelectMenuOptionBuilder()
                .setLabel(b.title.substring(0, 100))
                .setDescription(b.author ? `Par ${b.author.substring(0, 50)}` : 'Auteur inconnu')
                .setValue(`pal_add_${i}`)
            )
        );

    interaction.client.palSearchResults = interaction.client.palSearchResults || new Map();
    interaction.client.palSearchResults.set(interaction.user.id, results);

    const embed = createBaseEmbed().setTitle(`📚 Ajout PAL : "${query}"`).setDescription('Choisissez le livre exact :');
    await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
}

export async function sendPalList(interaction, targetUser, isUpdate = false) {
    if (!isUpdate && !interaction.deferred) await interaction.deferReply();

    try {
        const [rows] = await db.query(
            `SELECT title, author, total_pages, current_page, status 
             FROM books WHERE user_id = ? 
             ORDER BY CASE status WHEN 'reading' THEN 1 WHEN 'to_read' THEN 2 WHEN 'read' THEN 3 ELSE 4 END, added_at DESC LIMIT 15`,
            [targetUser.id]
        );

        if (rows.length === 0) {
            const emptyMsg = targetUser.id === interaction.user.id ? "Votre PAL est vide. Utilisez le bouton Ajouter !" : "La PAL est vide.";
            return isUpdate ? interaction.update({ embeds: [createBaseEmbed().setDescription(emptyMsg)] }) : interaction.editReply({ embeds: [createBaseEmbed().setDescription(emptyMsg)] });
        }

        const embed = createBaseEmbed().setTitle(`📚 PAL de ${targetUser.username}`).setThumbnail(targetUser.displayAvatarURL());
        let desc = '';

        for (const book of rows) {
            const emojis = { 'reading': '🔥', 'to_read': '📖', 'read': '✅', 'abandoned': '❌' };
            desc += `**${emojis[book.status] || '📖'} ${book.title}**\n*${book.author || 'Inconnu'}*\n`;
            
            if (book.status === 'reading' && book.total_pages) {
                const percent = Math.floor((book.current_page / book.total_pages) * 100);
                const bar = '🟩'.repeat(Math.floor(percent/10)) + '⬜'.repeat(10 - Math.floor(percent/10));
                desc += `Progression : ${bar} ${percent}% (${book.current_page}/${book.total_pages})\n`;
            } else if (book.status === 'reading') {
                desc += `Progression : Page ${book.current_page}\n`;
            }
            desc += '\n';
        }

        embed.setDescription(desc);
        
        const components = isUpdate ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] : [];
        isUpdate ? await interaction.update({ embeds: [embed], components }) : await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        isUpdate ? interaction.update({ content: 'Erreur.' }) : interaction.editReply({ content: 'Erreur.' });
    }
}

export async function handleRemove(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    
    try {
        const [rows] = await db.query(`SELECT id, title, author FROM books WHERE user_id = ? ORDER BY added_at DESC LIMIT 25`, [interaction.user.id]);
        if (rows.length === 0) return interaction.editReply({ embeds: [createErrorEmbed('Votre PAL est vide.')] });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_pal_remove')
            .setPlaceholder('Livre à supprimer...')
            .addOptions(rows.map(b => new StringSelectMenuOptionBuilder().setLabel(b.title.substring(0, 100)).setValue(`pal_remove_${b.id}`)));

        const embed = createBaseEmbed().setTitle('🗑️ Supprimer de la PAL').setDescription('Sélectionnez le livre à retirer :');
        await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    } catch (err) {
        console.error(err);
    }
}

export async function handleLink(interaction) {
    const url = interaction.options.getString('url');
    const userId = interaction.user.id;

    try {
        await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);
        await db.query(`UPDATE users SET pal_url = ? WHERE user_id = ?`, [url, userId]);
        await interaction.reply({ embeds: [createSuccessEmbed(`Lien vers votre PAL mis à jour :\n${url}`)], ephemeral: true });
    } catch (err) {
        console.error(err);
        await interaction.reply({ embeds: [createErrorEmbed('Une erreur est survenue.')], ephemeral: true });
    }
}

export async function handleImport(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const url = interaction.options.getString('url');
    const userId = interaction.user.id;

    if (!url.includes('livraddict.com/') || !url.includes('goto=pal')) {
        return interaction.editReply({ embeds: [createErrorEmbed('URL invalide. Elle doit provenir de Livraddict et contenir `?goto=pal`.')] });
    }

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const books = [];

        $('.livre_con').each((i, el) => {
            const title = $(el).find('a[href*="/biblio/livre/"]').first().text().trim();
            const author = $(el).find('a[href*="/biblio/auteur/"]').first().text().trim();
            const coverUrl = $(el).find('img[src*="/couv/"]').attr('src');
            
            // Extraction des pages dans le texte des infos
            const infosText = $(el).find('.infos').text();
            const pagesMatch = infosText.match(/(\d+)\s*pages/);
            const totalPages = pagesMatch ? parseInt(pagesMatch[1]) : null;

            if (title) {
                books.push({ title, author, coverUrl, totalPages });
            }
        });

        if (books.length === 0) {
            return interaction.editReply({ embeds: [createErrorEmbed('Aucun livre trouvé sur cette page. Vérifiez que votre profil est public.')] });
        }

        // Insertion en BDD
        await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);
        
        let count = 0;
        for (const b of books) {
            const [existing] = await db.query(`SELECT id FROM books WHERE user_id = ? AND title = ?`, [userId, b.title]);
            if (existing.length === 0) {
                await db.query(
                    `INSERT INTO books (user_id, title, author, cover_url, total_pages, status) VALUES (?, ?, ?, ?, ?, 'to_read')`,
                    [userId, b.title, b.author, b.coverUrl, b.totalPages]
                );
                count++;
            }
        }

        await interaction.editReply({ embeds: [createSuccessEmbed(`Importation terminée ! **${count}** nouveaux livres ajoutés à votre PAL.`)] });
    } catch (err) {
        console.error('[Import PAL] Erreur:', err);
        await interaction.editReply({ embeds: [createErrorEmbed('Une erreur est survenue lors du scraping.')] });
    }
}
