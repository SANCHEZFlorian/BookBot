import { SlashCommandBuilder } from 'discord.js';
import db from '../../config/database.js';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

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
            await interaction.deferReply({ ephemeral: true });
            const baseUrl = process.env.OVERLAY_BASE_URL || 'http://localhost';
            const port = process.env.OVERLAY_PORT || 8437;
            const prefix = baseUrl.includes('localhost') ? `http://localhost:${port}` : `${baseUrl}:${port}`;
            
            const timerUrl = `${prefix}/overlay/timer/${interaction.user.id}`;
            
            const [books] = await db.query(`SELECT id, title FROM books WHERE user_id = ? AND status IN ('to_read', 'reading') ORDER BY added_at DESC LIMIT 5`, [interaction.user.id]);
            
            const embed = createBaseEmbed()
                .setTitle('🎥 Vos Liens OBS')
                .setDescription('Vous disposez maintenant de liens séparés pour pouvoir placer le chrono et vos livres exactement où vous voulez sur votre stream !')
                .addFields({name:'⏱️ Lien du Chronomètre', value:`\`${timerUrl}\`\n*Largeur: 300, Hauteur: 60*`});

            if (books.length > 0) {
                let bookLinks = '';
                books.forEach(b => {
                    bookLinks += `**${b.title.substring(0, 40)}**\n\`${prefix}/overlay/book/${b.id}\`\n\n`;
                });
                embed.addFields({name:'📚 Liens de vos Livres Actuels', value:`*Largeur: 450, Hauteur: 180*\n\n${bookLinks}`});
            } else {
                embed.addFields({name:'📚 Liens de vos Livres', value:'*Ajoutez un livre à votre PAL pour obtenir son lien OBS.*'});
            }

            await interaction.editReply({ embeds: [embed] });
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
