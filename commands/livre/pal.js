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

export async function sendPalList(interaction, targetUser, isUpdate = false, page = 1) {
    if (!isUpdate && !interaction.deferred) await interaction.deferReply();

    try {
        const limit = 10;
        const offset = (page - 1) * limit;

        const [rows] = await db.query(
            `SELECT title, author, total_pages, current_page, status 
             FROM books WHERE user_id = ? 
             ORDER BY CASE status WHEN 'reading' THEN 1 WHEN 'to_read' THEN 2 WHEN 'read' THEN 3 ELSE 4 END, added_at DESC 
             LIMIT ? OFFSET ?`,
            [targetUser.id, limit, offset]
        );

        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM books WHERE user_id = ?`, [targetUser.id]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit) || 1;

        if (rows.length === 0) {
            const emptyMsg = targetUser.id === interaction.user.id ? "Votre PAL est vide. Utilisez le bouton Ajouter !" : "La PAL est vide.";
            const emptyPayload = { embeds: [createBaseEmbed().setDescription(emptyMsg)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] };
            return isUpdate ? interaction.update(emptyPayload) : interaction.editReply(emptyPayload);
        }

        const embed = createBaseEmbed()
            .setTitle(`📚 PAL de ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setFooter({ text: `Page ${page} / ${totalPages} • Total : ${total} livres` });

        let desc = '';
        for (const book of rows) {
            const emojis = { 'reading': '🔥', 'to_read': '📖', 'read': '✅', 'abandoned': '❌' };
            desc += `**${emojis[book.status] || '📖'} ${book.title}**\n*${book.author || 'Inconnu'}*\n`;
            
            if (book.status === 'reading' && book.total_pages) {
                const percent = Math.min(100, Math.floor((book.current_page / book.total_pages) * 100));
                const filled = Math.floor(percent / 10);
                const bar = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
                desc += `Progression : ${bar} ${percent}% (${book.current_page}/${book.total_pages})\n`;
            } else if (book.status === 'reading') {
                desc += `Progression : Page ${book.current_page}\n`;
            }
            desc += '\n';
        }

        embed.setDescription(desc);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pal_prev_${targetUser.id}_${page - 1}`)
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`pal_next_${targetUser.id}_${page + 1}`)
                .setLabel('➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages),
            new ButtonBuilder()
                .setCustomId('menu_retour')
                .setLabel('Menu')
                .setStyle(ButtonStyle.Secondary)
        );

        const payload = { embeds: [embed], components: [row] };
        isUpdate ? await interaction.update(payload) : await interaction.editReply(payload);
    } catch (err) {
        console.error(err);
        const errorPayload = { content: 'Erreur lors de la récupération de la PAL.', ephemeral: true };
        isUpdate ? interaction.update(errorPayload) : interaction.editReply(errorPayload);
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
    let url = interaction.options.getString('url');
    const userId = interaction.user.id;

    if (!url.includes('livraddict.com/') || !url.includes('goto=pal')) {
        return interaction.editReply({ embeds: [createErrorEmbed('URL invalide. Elle doit provenir de Livraddict et contenir `?goto=pal`.')] });
    }

    try {
        const fetchPage = async (pageUrl) => {
            try {
                const response = await fetch(pageUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' },
                    timeout: 10000 
                });
                if (!response.ok) return null;
                return await response.text();
            } catch (e) {
                console.error(`[Import PAL] Erreur fetch ${pageUrl}:`, e.message);
                return null;
            }
        };

        console.log(`[Import PAL] Lancement pour ${userId} : ${url}`);
        const htmlInitial = await fetchPage(url);
        if (!htmlInitial) return interaction.editReply({ embeds: [createErrorEmbed('Impossible d\'accéder à la page. Vérifiez l\'URL.')] });

        const $init = cheerio.load(htmlInitial);
        
        // Détection des pages
        let maxPage = 1;
        $init('a[href*="page="]').each((i, el) => {
            const href = $init(el).attr('href');
            const match = href.match(/page=(\d+)/);
            if (match) {
                const p = parseInt(match[1]);
                if (p > maxPage) maxPage = p;
            }
        });

        if (maxPage > 20) maxPage = 20;
        console.log(`[Import PAL] Pages à traiter : ${maxPage}`);

        const allBooks = [];
        const baseUrl = url.split('?')[0];

        for (let p = 1; p <= maxPage; p++) {
            const pageUrl = `${baseUrl}?page=${p}&goto=pal`;
            const html = (p === 1 && !url.includes('page=')) ? htmlInitial : await fetchPage(pageUrl);
            if (!html) continue;

            const $page = cheerio.load(html);
            $page('.bibliotheque_list li').each((i, el) => {
                const title = $page(el).find('h2 a').first().text().trim();
                const author = $page(el).find('p a[href*="/biblio/auteur/"]').first().text().trim();
                let coverUrl = $page(el).find('img.miniature').attr('src');
                
                if (coverUrl && coverUrl.startsWith('/')) {
                    coverUrl = 'https://www.livraddict.com' + coverUrl;
                }
                
                const allText = $page(el).text();
                const pagesMatch = allText.match(/(\d+)\s*pages/);
                const totalPages = pagesMatch ? parseInt(pagesMatch[1]) : null;

                if (title) {
                    allBooks.push({ title, author, coverUrl, totalPages });
                }
            });
            
            console.log(`[Import PAL] Page ${p}/${maxPage} terminée.`);
            if (maxPage > 1) await new Promise(r => setTimeout(r, 800));
        }

        if (allBooks.length === 0) {
            return interaction.editReply({ embeds: [createErrorEmbed('Aucun livre trouvé.')] });
        }

        // 3. Insertion en BDD avec recherche Google Books
        await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);
        
        let count = 0;
        for (const b of allBooks) {
            try {
                const [existing] = await db.query(`SELECT id FROM books WHERE user_id = ? AND title = ?`, [userId, b.title]);
                if (existing.length === 0) {
                    // Recherche ID Google pour lier les métadonnées
                    let googleId = null;
                    const searchResults = await searchBook(`${b.title} ${b.author}`);
                    if (searchResults && searchResults.length > 0) {
                        const bestMatch = searchResults[0];
                        googleId = bestMatch.id;
                        // On privilégie la couverture Google si celle de Livraddict est de mauvaise qualité
                        if (!b.coverUrl && bestMatch.coverUrl) b.coverUrl = bestMatch.coverUrl;
                        if (!b.totalPages && bestMatch.pageCount) b.totalPages = bestMatch.pageCount;
                    }

                    await db.query(
                        `INSERT INTO books (user_id, title, author, cover_url, total_pages, status, google_book_id) VALUES (?, ?, ?, ?, ?, 'to_read', ?)`,
                        [userId, b.title, b.author, b.coverUrl, b.totalPages, googleId]
                    );
                    count++;
                    
                    // Délai pour ne pas spammer l'API Google
                    await new Promise(r => setTimeout(r, 300));
                }
            } catch (dbErr) {
                console.error(`[Import PAL] Erreur BDD pour "${b.title}":`, dbErr.message);
            }
        }

        await interaction.editReply({ embeds: [createSuccessEmbed(`Importation terminée ! **${allBooks.length}** livres récupérés. **${count}** nouveaux ajouts.`)] });
    } catch (err) {
        console.error('[Import PAL] Erreur Fatale:', err);
        await interaction.editReply({ embeds: [createErrorEmbed(`Erreur : ${err.message}`)] });
    }
}
