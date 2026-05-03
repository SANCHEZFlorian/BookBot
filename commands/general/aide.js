import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { createBaseEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('aide')
        .setDescription('Affiche le guide complet et les explications du bot'),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = createBaseEmbed()
            .setTitle('📖 Guide d\'utilisation de BookBot')
            .setDescription('Bienvenue sur **BookBot** ! L\'assistant parfait pour les lecteurs et les streameurs littéraires.\n\nUtilisez le menu déroulant ci-dessous pour explorer les différentes fonctionnalités du bot.')
            .setThumbnail(interaction.client.user.displayAvatarURL());

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_help')
                .setPlaceholder('Choisissez une catégorie')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Commandes Générales').setValue('help_general').setEmoji('🌐').setDescription('Profil, aide, menu global'),
                    new StringSelectMenuOptionBuilder().setLabel('Gestion de Livres').setValue('help_books').setEmoji('📚').setDescription('Ajouter, modifier, suivre vos lectures'),
                    new StringSelectMenuOptionBuilder().setLabel('Sessions de Lecture').setValue('help_sessions').setEmoji('⏱️').setDescription('Lire ensemble avec un chronomètre'),
                    new StringSelectMenuOptionBuilder().setLabel('Musique & Ambiance').setValue('help_music').setEmoji('🎵').setDescription('Musique Lo-Fi et sons d\'ambiance'),
                    new StringSelectMenuOptionBuilder().setLabel('Stream & Overlay').setValue('help_stream').setEmoji('🎥').setDescription('Configuration de l\'overlay OBS'),
                )
        );

        await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });
    },
};

export async function handleHelpSelect(interaction) {
    const value = interaction.values[0];
    const embed = createBaseEmbed();

    if (value === 'help_general') {
        embed.setTitle('🌐 Commandes Générales')
            .addFields(
                { name: '`/profil`', value: 'Affiche vos stats, votre grade et votre progression.' },
                { name: '`/menu`', value: 'Le centre de contrôle interactif du bot.' },
                { name: '`/aide`', value: 'Affiche ce message.' }
            );
    }
    else if (value === 'help_books') {
        embed.setTitle('📚 Gestion de Livres')
            .addFields(
                { name: '`/livre ajouter`', value: 'Ajoute un livre à votre bibliothèque (via recherche Google Books).' },
                { name: '`/livre lire`', value: 'Définit un livre comme étant votre lecture actuelle.' },
                { name: '`/livre progression`', value: 'Met à jour votre page actuelle.' },
                { name: '`/livre liste`', value: 'Affiche votre PAL (Pile à Lire).' }
            );
    }
    else if (value === 'help_sessions') {
        embed.setTitle('⏱️ Les Sessions de Lecture')
            .setDescription('Les sessions sont des périodes de lecture chronométrées pour rester concentré.')
            .addFields(
                { name: 'Lancer une session', value: 'Allez dans `/menu` > Sessions > Lancer, ou tapez `/session lancer`. Une annonce est faite avec l\'heure de fin.' },
                { name: 'Les scores', value: 'À la fin de la session, un bouton s\'affiche. Cliquez dessus pour entrer le nombre de pages que vous avez lues pendant le temps imparti. Ces pages seront ajoutées à votre livre en cours !' },
                { name: 'Sons (Vocal)', value: 'Si vous êtes dans un salon vocal avec le bot, une cloche retentira automatiquement au début et à la fin de la session.' }
            );
    }
    else if (value === 'help_music') {
        embed.setTitle('🎵 Musique & Ambiance')
            .setDescription('Mettez une ambiance cosy pendant que vous lisez.')
            .addFields(
                { name: 'Radios 24/7', value: 'Allez dans `/menu` > Musique, ou tapez `/musique jouer`. Le bot rejoindra votre salon vocal et diffusera une webradio (LoFi Chillhop, LoFi Beats ou Jazz).' },
                { name: '`/musique stop`', value: 'Arrête la musique et fait quitter le bot.' },
                { name: 'Régler le son', value: 'Faites un **clic droit** sur le bot dans le salon vocal et baissez son volume localement.' }
            );
    }
    else if (value === 'help_stream') {
        embed.setTitle('🎥 Outils pour les Streamers')
            .setDescription('Affichez vos lectures directement sur votre stream Twitch ou YouTube !')
            .addFields(
                { name: 'L\'Overlay OBS (`/stream overlay`)', value: 'Vous donne des liens privés pour votre chrono et vos livres. Ajoutez-les en tant que "Source Navigateur" sur OBS.' },
                { name: 'Livre Stream', value: 'Allez dans `/menu` > "Livre Stream" pour choisir le livre actuel qui s\'affichera sur votre lien global OBS.' },
                { name: 'Annonces', value: '`/stream annonce` pour prévenir que vous êtes en live, avec un beau message formaté.' }
            );
    }

    await interaction.update({ embeds: [embed], components: interaction.message.components });
}
