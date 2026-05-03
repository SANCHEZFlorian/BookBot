import { SlashCommandBuilder } from 'discord.js';
import db from '../../config/database.js';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export async function sendStreamOverlay(interaction, user, isUpdate = false, page = 1) {
    if (!isUpdate && !interaction.deferred) await interaction.deferReply({ ephemeral: true });
    const baseUrl = process.env.OVERLAY_BASE_URL || 'http://localhost';
    const port = parseInt(process.env.OVERLAY_PORT) || 8437;
    const prefix = (port === 80 || port === 443) ? baseUrl : `${baseUrl}:${port}`;
    
    const timerUrl = `${prefix}/overlay/timer/${user.id}`;
    
    const limit = 5;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
        `SELECT id, title, current_page FROM books WHERE user_id = ? AND status IN ('to_read', 'reading') ORDER BY current_page DESC LIMIT ? OFFSET ?`, 
        [user.id, limit, offset]
    );

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM books WHERE user_id = ? AND status IN ('to_read', 'reading')`, [user.id]);
    const totalPages = Math.ceil(total / limit) || 1;
    
    const embed = createBaseEmbed()
        .setTitle('🎥 Vos Liens OBS')
        .setDescription('Ajoutez ces liens en tant que **Source Navigateur** dans OBS.')
        .addFields(
            { name: '⭐ Livre Actuel (Recommandé)', value: `*Ce lien change tout seul quand vous changez de Livre Stream dans le /menu !*\n\`\`\`text\n${prefix}/overlay/current/${user.id}\n\`\`\`\n*Dimensions: 450x180*` },
            { name: '⏱️ Le Chronomètre', value:`\`\`\`text\n${timerUrl}\n\`\`\`\n*Dimensions: 300x60*`}
        )
        .setFooter({ text: `Page ${page} / ${totalPages} • Total : ${total} livres en cours` });

    if (rows.length > 0) {
        let bookLinks = '';
        rows.forEach(b => {
            bookLinks += `**${b.title.substring(0, 40)}** (Page ${b.current_page})\n\`\`\`text\n${prefix}/overlay/book/${b.id}\n\`\`\`\n`;
        });
        embed.addFields({name:'📚 Liens de vos Livres (Triés par avancement)', value:`*Largeur: 450, Hauteur: 180*\n\n${bookLinks}`});
    } else {
        embed.addFields({name:'📚 Liens de vos Livres', value:'*Ajoutez un livre à votre PAL pour obtenir son lien OBS.*'});
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`stream_prev_${user.id}_${page - 1}`)
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`stream_next_${user.id}_${page + 1}`)
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages)
    );

    isUpdate ? await interaction.update({ embeds: [embed], components: [row] }) : await interaction.editReply({ embeds: [embed], components: [row] });
}

export const command = {
    data: new SlashCommandBuilder()
        .setName('stream')
        .setDescription('Commandes pour les streamers')
        .addSubcommand(subcmd => 
            subcmd.setName('overlay')
                  .setDescription('Obtient le lien de votre overlay OBS')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('annonce')
                  .setDescription('Annonce votre stream en direct')
                  .addStringOption(opt => opt.setName('lien').setDescription('Lien (Twitch/YouTube)').setRequired(true))
                  .addStringOption(opt => opt.setName('message').setDescription('Message perso').setRequired(false))
        ),

    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'overlay') {
            await sendStreamOverlay(interaction, interaction.user);
        } 
        else if (subcmd === 'annonce') {
            await interaction.deferReply({ ephemeral: true });
            const [g] = await db.query(`SELECT session_channel_id FROM guilds WHERE guild_id = ?`, [interaction.guildId]);
            if (!g[0]?.session_channel_id) return interaction.editReply({ embeds: [createErrorEmbed('Salon non configuré.')] });
            const ch = await interaction.guild.channels.fetch(g[0].session_channel_id);
            
            const link = interaction.options.getString('lien');
            const msg = interaction.options.getString('message') || 'Rejoignez-moi !';
            
            const [b] = await db.query(`SELECT title, author, cover_url FROM books WHERE user_id = ? AND is_current = 1 LIMIT 1`, [interaction.user.id]);
            
            const embed = createBaseEmbed().setTitle(`🔴 ${interaction.user.username} est en direct`).setURL(link).setDescription(msg).setThumbnail(interaction.user.displayAvatarURL());
            if (b.length > 0) { embed.addFields({ name: 'Livre', value: `**${b[0].title}**\n*${b[0].author || ''}*` }); if(b[0].cover_url) embed.setImage(b[0].cover_url); }
            
            await ch.send({ content: '@here', embeds: [embed] });
            await interaction.editReply({ content: '✅ Annoncé.' });
        }
    }
};
