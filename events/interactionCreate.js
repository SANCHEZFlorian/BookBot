import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import db from '../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embedBuilder.js';
import { checkLevelUp } from '../services/levelService.js';
import { searchBook } from '../services/bookApiService.js';
import { sendDashboard } from '../commands/general/menu.js';
import { sendPalList } from '../commands/livre/pal.js';
import { sendProfile } from '../commands/general/profil.js';
import { playRadio, stopMusic } from '../services/musicService.js';
import { startSession, stopCurrentSession } from '../services/sessionService.js';

export const event = {
    name: 'interactionCreate',
    async execute(interaction) {
        // --- Commandes Slash ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`[Erreur] Exécution commande ${interaction.commandName}:`, error);
                const reply = { embeds: [createErrorEmbed('Une erreur est survenue lors de l\'exécution de cette commande.')], ephemeral: true };
                if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
                else await interaction.reply(reply);
            }
        }

        // --- Select Menus ---
        else if (interaction.isStringSelectMenu()) {
            // Ajouter un livre depuis la recherche
            if (interaction.customId === 'select_pal_add' || interaction.customId === 'select_book_search') {
                const results = interaction.client.palSearchResults?.get(interaction.user.id) || interaction.client.bookSearchResults?.get(interaction.user.id);
                if (!results) return interaction.update({ content: 'Session expirée.', embeds: [], components: [] });

                const index = parseInt(interaction.values[0].split('_')[2]);
                const book = results[index];

                if (interaction.customId === 'select_book_search') {
                    // Juste afficher le livre
                    const { createBookEmbed } = await import('../commands/livre/livre.js');
                    const payload = await createBookEmbed(book, interaction.user);
                    return interaction.update(payload);
                }

                // Ajouter à la PAL
                try {
                    await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [interaction.user.id, interaction.user.username]);
                    await db.query(`INSERT INTO books (user_id, title, author, cover_url, total_pages, google_book_id, status) VALUES (?, ?, ?, ?, ?, ?, 'to_read')`,
                        [interaction.user.id, book.title, book.author, book.coverUrl, book.pageCount, book.id]
                    );
                    await interaction.update({ embeds: [createSuccessEmbed(`**${book.title}** a été ajouté à votre PAL !`)], components: [] });
                } catch (e) {
                    interaction.update({ embeds: [createErrorEmbed('Erreur lors de l\'ajout.')], components: [] });
                }
            }

            // Retirer un livre de la PAL
            else if (interaction.customId === 'select_pal_remove') {
                const bookId = interaction.values[0].split('_')[2];
                await db.query(`DELETE FROM books WHERE id = ? AND user_id = ?`, [bookId, interaction.user.id]);
                await interaction.update({ embeds: [createSuccessEmbed('Livre retiré de votre PAL.')], components: [] });
            }

            // Choisir le livre stream
            else if (interaction.customId === 'select_stream_book') {
                const bookId = interaction.values[0].split('_')[2];
                await db.query(`UPDATE books SET is_current = 0 WHERE user_id = ?`, [interaction.user.id]);
                await db.query(`UPDATE books SET is_current = 1, status = 'reading' WHERE id = ? AND user_id = ?`, [bookId, interaction.user.id]);
                await interaction.update({ embeds: [createSuccessEmbed('Livre mis à jour sur votre Overlay OBS.')], components: [] });
            }

            // Mettre à jour la progression d'un livre (sélection)
            else if (interaction.customId === 'select_pal_progression') {
                const bookId = interaction.values[0].split('_')[2];
                // Afficher modal pour la page
                const modal = new ModalBuilder().setCustomId(`modal_prog_${bookId}`).setTitle('Mettre à jour');
                const pi = new TextInputBuilder().setCustomId('page_atteinte').setLabel('Page actuelle ?').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(pi));
                await interaction.showModal(modal);
            }

            // Sélectionner un livre pour donner son avis
            else if (interaction.customId === 'select_avis_book') {
                const results = interaction.client.avisSearchResults?.get(interaction.user.id);
                if (!results) return interaction.update({ content: 'Session expirée.', embeds: [], components: [] });

                const index = parseInt(interaction.values[0].split('_')[2]);
                const book = results[index];

                const modal = new ModalBuilder().setCustomId(`modal_avis_${index}`).setTitle('Votre Chronique');

                const noteInput = new TextInputBuilder()
                    .setCustomId('rating')
                    .setLabel('Note (sur 5)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(1)
                    .setRequired(true);

                const commentInput = new TextInputBuilder()
                    .setCustomId('comment')
                    .setLabel('Votre avis complet')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(2000)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(noteInput),
                    new ActionRowBuilder().addComponents(commentInput)
                );

                await interaction.showModal(modal);
            }

            // Sélectionner un livre pour lancer une LC
            else if (interaction.customId === 'select_lc_book') {
                const results = interaction.client.lcSearchResults?.get(interaction.user.id);
                if (!results) return interaction.update({ content: 'Session expirée.', embeds: [], components: [] });

                const index = parseInt(interaction.values[0].split('_')[2]);
                const book = results[index];

                const modal = new ModalBuilder().setCustomId(`modal_lc_start_${index}`).setTitle('Détails de la LC');

                const dateInput = new TextInputBuilder()
                    .setCustomId('date')
                    .setLabel('Date de début (ex: À partir du 10 Juin)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const rythmeInput = new TextInputBuilder()
                    .setCustomId('rythme')
                    .setLabel('Découpage (ex: 2 chapitres par jour)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(dateInput),
                    new ActionRowBuilder().addComponents(rythmeInput)
                );

                await interaction.showModal(modal);
            }

            // Menu d'aide
            else if (interaction.customId === 'select_help') {
                const { handleHelpSelect } = await import('../commands/general/aide.js');
                await handleHelpSelect(interaction);
            }
        }

        // --- Boutons (Menu Global & Sessions) ---
        else if (interaction.isButton()) {
            const id = interaction.customId;

            // Retour au menu principal
            if (id === 'menu_retour') {
                await sendDashboard(interaction, true);
            }

            // Ligne 1 : PAL
            else if (id === 'menu_pal_voir') {
                await sendPalList(interaction, interaction.user, true);
            }
            else if (id.startsWith('pal_prev_') || id.startsWith('pal_next_')) {
                const parts = id.split('_');
                const targetUserId = parts[2];
                const page = parseInt(parts[3]);
                const targetUser = await interaction.client.users.fetch(targetUserId);
                await sendPalList(interaction, targetUser, true, page);
            }

            // Rejoindre une LC
            else if (id.startsWith('btn_lc_join_')) {
                await interaction.deferReply({ ephemeral: true });
                const bookId = id.substring('btn_lc_join_'.length);
                const bookDetails = interaction.client.lcActiveBooks?.get(bookId);

                if (!bookDetails) {
                    return interaction.editReply({ embeds: [createErrorEmbed('Détails du livre introuvables en mémoire, désolé.')] });
                }

                // Ajouter à la PAL
                try {
                    await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [interaction.user.id, interaction.user.username]);
                    await db.query(`INSERT INTO books (user_id, title, author, cover_url, total_pages, google_book_id, status) VALUES (?, ?, ?, ?, ?, ?, 'reading')`,
                        [interaction.user.id, bookDetails.title, bookDetails.author, bookDetails.coverUrl, bookDetails.pageCount, bookDetails.id]
                    );

                    // L'ajouter au fil de discussion
                    if (interaction.message.hasThread) {
                        const thread = interaction.message.thread;
                        await thread.members.add(interaction.user.id);
                        await interaction.editReply({ embeds: [createSuccessEmbed(`**${bookDetails.title}** ajouté à ta PAL ! Tu as été ajouté au fil de discussion de la LC.`)] });
                    } else {
                        await interaction.editReply({ embeds: [createSuccessEmbed(`**${bookDetails.title}** ajouté à ta PAL ! (Pas de fil de discussion trouvé)`)] });
                    }
                } catch (e) {
                    interaction.editReply({ embeds: [createErrorEmbed('Ce livre est peut-être déjà dans ta PAL.')] });
                }
            }

            // Voir les avis d'un livre
            else if (id.startsWith('btn_voir_avis_')) {
                const bookId = id.substring('btn_voir_avis_'.length);
                const [reviews] = await db.query(`SELECT user_id, rating, comment, created_at FROM book_reviews WHERE google_book_id = ? ORDER BY created_at DESC LIMIT 5`, [bookId]);

                if (reviews.length === 0) {
                    return interaction.reply({ embeds: [createErrorEmbed('Aucun avis n\'a encore été laissé pour ce livre.')], ephemeral: true });
                }

                const embed = createBaseEmbed().setTitle('🌟 Avis des lecteurs');
                for (const r of reviews) {
                    const stars = '⭐'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                    let text = r.comment;
                    if (text.length > 200) text = text.substring(0, 197) + '...';
                    embed.addFields({ name: `<@${r.user_id}> - ${stars}`, value: text });
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            else if (id === 'menu_pal_ajouter') {
                const modal = new ModalBuilder().setCustomId('modal_pal_add').setTitle('Ajouter à la PAL');
                const ti = new TextInputBuilder().setCustomId('titre').setLabel('Titre du livre').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(ti));
                await interaction.showModal(modal);
            }
            else if (id === 'menu_pal_maj') {
                const [rows] = await db.query(`SELECT id, title FROM books WHERE user_id = ? AND status IN ('to_read', 'reading') ORDER BY added_at DESC LIMIT 25`, [interaction.user.id]);
                if (rows.length === 0) return interaction.reply({ embeds: [createErrorEmbed('Aucun livre en cours.')], ephemeral: true });

                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_pal_progression').setPlaceholder('Quel livre ?')
                    .addOptions(rows.map(b => new StringSelectMenuOptionBuilder().setLabel(b.title.substring(0,100)).setValue(`pal_prog_${b.id}`)));

                await interaction.update({ embeds: [createBaseEmbed().setTitle('🎯 Progression').setDescription('Sélectionnez le livre lu :')], components: [new ActionRowBuilder().addComponents(selectMenu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] });
            }

            // Ligne 2 : Sessions
            else if (id === 'menu_session') {
                const embed = createBaseEmbed().setTitle('⏱️ Menu Session').setDescription('Gérez vos sessions de lecture.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_session_start').setLabel('Lancer / Configurer').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_session_stop').setLabel('Arrêter').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_session_score').setLabel('Saisir Score').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );
                await interaction.update({ embeds: [embed], components: [row] });
            }
            else if (id === 'btn_session_start') {
                const modal = new ModalBuilder().setCustomId('modal_session_start').setTitle('Configurer la Session');
                const t1 = new TextInputBuilder().setCustomId('duree').setLabel('Durée de la session (minutes)').setStyle(TextInputStyle.Short).setValue('45').setRequired(true);
                const t2 = new TextInputBuilder().setCustomId('pause').setLabel('Temps de pause (minutes)').setStyle(TextInputStyle.Short).setValue('15').setRequired(true);
                const t3 = new TextInputBuilder().setCustomId('boucles').setLabel('Nombre de sessions à enchaîner').setStyle(TextInputStyle.Short).setValue('1').setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(t1), new ActionRowBuilder().addComponents(t2), new ActionRowBuilder().addComponents(t3));
                await interaction.showModal(modal);
            }
            else if (id === 'btn_session_stop') {
                await interaction.deferUpdate();
                await stopCurrentSession(interaction);
            }
            else if (id === 'btn_session_score' || id.startsWith('session_score_')) {
                const sessionId = id.startsWith('session_score_') ? id.split('_')[2] : 'latest';
                const modal = new ModalBuilder().setCustomId(`modal_score_${sessionId}`).setTitle('Score Session');
                const pi = new TextInputBuilder().setCustomId('pages_read').setLabel('Pages lues').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(pi));
                await interaction.showModal(modal);
            }

            // Ligne 2 : Stream
            else if (id === 'menu_stream_livre') {
                const { handleSetStreamBook } = await import('../commands/livre/livre.js');
                await handleSetStreamBook(interaction, true);
            }

            // Ligne 3 : Profil & Musique
            else if (id === 'menu_profil') {
                await sendProfile(interaction, interaction.user, true);
            }
            else if (id === 'menu_musique') {
                const embed = createBaseEmbed().setTitle('🎵 Menu Musique').setDescription('Choisissez une station à lancer dans votre salon vocal.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_music_chill').setLabel('LoFi Chillhop').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_music_lofi').setLabel('LoFi Beats').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_music_jazz').setLabel('Cosy Jazz').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_music_stop').setLabel('Arrêter').setStyle(ButtonStyle.Danger)
                );
                const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary));
                await interaction.update({ embeds: [embed], components: [row, row2] });
            }
            else if (id.startsWith('btn_music_')) {
                const action = id.split('_')[2];
                if (action === 'stop') {
                    if (stopMusic(interaction.guildId)) await interaction.update({ embeds: [createSuccessEmbed('Musique arrêtée.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] });
                    else await interaction.reply({ content: 'Rien en cours.', ephemeral: true });
                } else {
                    await interaction.deferUpdate();
                    await playRadio(interaction, action === 'chill' ? 'chillhop' : action);
                    await interaction.editReply({ embeds: [createSuccessEmbed('Musique lancée dans votre salon.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] });
                }
            }
        }

        // --- Modals (Formulaires) ---
        else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_session_start') {
                const d = parseInt(interaction.fields.getTextInputValue('duree')) || 45;
                const p = parseInt(interaction.fields.getTextInputValue('pause')) || 15;
                const b = parseInt(interaction.fields.getTextInputValue('boucles')) || 1;

                await interaction.deferUpdate();

                const [rows] = await db.query(`SELECT session_channel_id FROM guilds WHERE guild_id = ?`, [interaction.guildId]);
                if (rows.length === 0 || !rows[0].session_channel_id) {
                    return interaction.followUp({ embeds: [createErrorEmbed('Salon non configuré. `/session config` d\'abord.')], ephemeral: true });
                }

                await startSession(interaction, d, p, b, 1);
            }
            else if (interaction.customId === 'modal_pal_add') {
                const query = interaction.fields.getTextInputValue('titre');
                const { handleAdd } = await import('../commands/livre/pal.js');
                await handleAdd(interaction, query);
            }

            else if (interaction.customId.startsWith('modal_prog_')) {
                const bookId = interaction.customId.split('_')[2];
                const pageStr = interaction.fields.getTextInputValue('page_atteinte');
                const page = parseInt(pageStr);
                if (isNaN(page)) return interaction.reply({ content: 'Nombre invalide.', ephemeral: true });

                try {
                    const [books] = await db.query(`SELECT title, current_page, total_pages FROM books WHERE id = ? AND user_id = ?`, [bookId, interaction.user.id]);
                    if (books.length === 0) return interaction.reply({ content: 'Erreur.', ephemeral: true });
                    const book = books[0];

                    const oldPage = book.current_page || 0;
                    let pagesRead = page - oldPage;
                    if (pagesRead < 0) pagesRead = 0; // Au cas où on se trompe en arrière

                    if (book.total_pages && page >= book.total_pages) {
                        await db.query(`UPDATE books SET current_page = total_pages, status = 'read', is_current = 0 WHERE id = ?`, [bookId]);
                        await interaction.update({ embeds: [createSuccessEmbed(`🎉 Félicitations, vous avez terminé **${book.title}** !`)], components: [] });
                    } else {
                        await db.query(`UPDATE books SET current_page = ?, status = 'reading' WHERE id = ?`, [page, bookId]);
                        await interaction.update({ embeds: [createSuccessEmbed(`Progression mise à jour : page **${page}**.`)], components: [] });
                    }

                    // Ajout au total de l'utilisateur
                    if (pagesRead > 0) {
                        await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [interaction.user.id, interaction.user.username]);
                        await db.query(`UPDATE users SET total_pages_read = total_pages_read + ? WHERE user_id = ?`, [pagesRead, interaction.user.id]);
                        await checkLevelUp(interaction.user.id, interaction);
                    }
                } catch(e) { console.error(e); interaction.reply({ content: 'Erreur', ephemeral:true }); }
            }

            else if (interaction.customId.startsWith('modal_score_')) {
                const pages = parseInt(interaction.fields.getTextInputValue('pages_read'));
                if (isNaN(pages)) return interaction.reply({ content: 'Nombre invalide.', ephemeral: true });
                let sessionId = interaction.customId.split('_')[2];
                const userId = interaction.user.id;

                try {
                    await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);

                    if (sessionId === 'latest') {
                        const [s] = await db.query(`SELECT id FROM sessions WHERE guild_id = ? ORDER BY started_at DESC LIMIT 1`, [interaction.guildId]);
                        if (s.length > 0) sessionId = s[0].id;
                        else sessionId = null;
                    }

                    if (sessionId && sessionId !== 'latest') {
                        await db.query(`INSERT INTO session_scores (session_id, user_id, pages_read) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pages_read = ?`, [sessionId, userId, pages, pages]);
                    }

                    await db.query(`UPDATE users SET total_pages_read = total_pages_read + ? WHERE user_id = ?`, [pages, userId]);

                    // Mise à jour de la PAL si livre en stream/en cours (is_current = 1)
                    const [books] = await db.query(`SELECT id, current_page, total_pages, title FROM books WHERE user_id = ? AND is_current = 1 LIMIT 1`, [userId]);
                    let bonus = '';
                    if (books.length > 0) {
                        const b = books[0];
                        const np = b.current_page + pages;
                        if (b.total_pages && np >= b.total_pages) {
                            await db.query(`UPDATE books SET current_page = total_pages, status = 'read', is_current = 0 WHERE id = ?`, [b.id]);
                            bonus = `\n🎉 **Félicitations**, vous avez terminé **${b.title}** !`;
                        } else {
                            await db.query(`UPDATE books SET current_page = ? WHERE id = ?`, [np, b.id]);
                            bonus = `\nLivre stream avancé à la page ${np}.`;
                        }
                    }

                    await interaction.reply({ embeds: [createSuccessEmbed(`Score : **${pages} pages** ! 👏${bonus}`)], ephemeral: true });
                    await checkLevelUp(userId, interaction);
                } catch(e) { console.error(e); interaction.reply({ content: 'Erreur', ephemeral:true }); }
            }

            else if (interaction.customId.startsWith('modal_avis_')) {
                const index = parseInt(interaction.customId.split('_')[2]);
                const results = interaction.client.avisSearchResults?.get(interaction.user.id);
                if (!results) return interaction.reply({ content: 'Erreur : session expirée.', ephemeral: true });
                const book = results[index];

                const ratingStr = interaction.fields.getTextInputValue('rating');
                let rating = parseInt(ratingStr);
                if (isNaN(rating) || rating < 0 || rating > 5) rating = 5; // Default fallback

                const comment = interaction.fields.getTextInputValue('comment');

                try {
                    await db.query(
                        `INSERT INTO book_reviews (user_id, google_book_id, book_title, rating, comment) VALUES (?, ?, ?, ?, ?)`,
                        [interaction.user.id, book.id, book.title, rating, comment]
                    );

                    await interaction.reply({ embeds: [createSuccessEmbed('Votre chronique a été enregistrée !')], ephemeral: true });

                    // Publier dans le salon de chroniques si configuré
                    const [guildConfig] = await db.query(`SELECT reviews_channel_id FROM guilds WHERE guild_id = ?`, [interaction.guildId]);
                    if (guildConfig[0]?.reviews_channel_id) {
                        const reviewsChannel = await interaction.guild.channels.fetch(guildConfig[0].reviews_channel_id).catch(() => null);
                        if (reviewsChannel) {
                            const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
                            const embed = createBaseEmbed()
                                .setColor('#D4A853')
                                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                                .setTitle(`Chronique : ${book.title}`)
                                .setDescription(`**Note :** ${stars}\n\n${comment}`);

                            if (book.coverUrl) embed.setThumbnail(book.coverUrl);
                            if (book.author) embed.addFields({ name: 'Auteur', value: book.author });

                            if (reviewsChannel.type === ChannelType.GuildForum) {
                                await reviewsChannel.threads.create({
                                    name: `Chronique : ${book.title.substring(0, 50)}`,
                                    message: { embeds: [embed] }
                                });
                            } else {
                                await reviewsChannel.send({ embeds: [embed] });
                            }
                        }
                    }
                } catch(e) { console.error(e); interaction.reply({ content: 'Erreur lors de la sauvegarde.', ephemeral: true }); }
            }

            else if (interaction.customId.startsWith('modal_lc_start_')) {
                const index = parseInt(interaction.customId.split('_')[3]);
                const results = interaction.client.lcSearchResults?.get(interaction.user.id);
                if (!results) return interaction.reply({ content: 'Erreur : session expirée.', ephemeral: true });
                const book = results[index];

                const dateDebut = interaction.fields.getTextInputValue('date');
                const rythme = interaction.fields.getTextInputValue('rythme');

                try {
                    // Trouver le salon agenda-lectures
                    const agendaChannel = interaction.guild.channels.cache.find(c => c.name === 'agenda-lectures');
                    if (!agendaChannel) {
                        return interaction.reply({ content: 'Salon #agenda-lectures introuvable. Veuillez exécuter `/setup`.', ephemeral: true });
                    }

                    // Stocker le livre en mémoire pour que les gens puissent le rejoindre
                    interaction.client.lcActiveBooks = interaction.client.lcActiveBooks || new Map();
                    interaction.client.lcActiveBooks.set(book.id, book);

                    const embed = createBaseEmbed()
                        .setColor('#D4A853')
                        .setTitle(`📖 Nouvelle Lecture Commune (LC) !`)
                        .setDescription(`Rejoignez-nous pour lire **${book.title}** !`)
                        .addFields(
                            { name: 'Auteur', value: book.author || 'Inconnu', inline: true },
                            { name: 'Pages', value: book.pageCount ? `${book.pageCount}` : 'Inconnu', inline: true },
                            { name: '📅 Date de Début', value: dateDebut, inline: false },
                            { name: '⏱️ Rythme / Découpage', value: rythme, inline: false }
                        );

                    if (book.coverUrl) embed.setThumbnail(book.coverUrl);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`btn_lc_join_${book.id}`)
                            .setLabel('🙋‍♀️ Participer à la LC')
                            .setStyle(ButtonStyle.Success)
                    );

                    await interaction.deferReply({ ephemeral: true });
                    const message = await agendaChannel.send({ embeds: [embed], components: [row] });

                    // Créer le Thread privé
                    const thread = await message.startThread({
                        name: `💬 Discussions LC : ${book.title.substring(0, 50)}`,
                        autoArchiveDuration: 10080, // 7 days
                        reason: 'Thread pour la Lecture Commune'
                    });

                    await thread.send(`Bienvenue dans le salon de la LC pour **${book.title}** ! Vous pouvez discuter de votre avancée ici. N'oubliez pas d'utiliser les balises spoilers \`||texte||\` si besoin !`);

                    await interaction.editReply({ content: '✅ Lecture Commune lancée avec succès dans #agenda-lectures !' });
                } catch(e) { console.error(e); interaction.reply({ content: 'Erreur lors de la création de la LC.', ephemeral: true }); }
            }
        }
    },
};
