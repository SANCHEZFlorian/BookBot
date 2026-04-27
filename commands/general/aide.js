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

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Choisissez un sujet à explorer...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Le Menu Global').setValue('help_menu_global').setEmoji('🎛️').setDescription('L\'outil central pour tout gérer'),
                new StringSelectMenuOptionBuilder().setLabel('La Pile à Lire (PAL)').setValue('help_pal').setEmoji('📚').setDescription('Gérer vos livres et progressions'),
                new StringSelectMenuOptionBuilder().setLabel('Sprints de Lecture').setValue('help_sprints').setEmoji('⏱️').setDescription('Lire ensemble avec un chronomètre'),
                new StringSelectMenuOptionBuilder().setLabel('Niveaux & Profil').setValue('help_profil').setEmoji('🏆').setDescription('Gagner de l\'XP en lisant'),
                new StringSelectMenuOptionBuilder().setLabel('Outils Streamer').setValue('help_stream').setEmoji('🎥').setDescription('Overlay OBS et annonces'),
                new StringSelectMenuOptionBuilder().setLabel('Musique & Ambiance').setValue('help_musique').setEmoji('🎵').setDescription('Radios Lofi et Jazz')
            );

        await interaction.editReply({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(selectMenu)] 
        });
    },
};

// Fonction exportée pour gérer les clics du menu déroulant d'aide dans interactionCreate.js
export async function handleHelpSelect(interaction) {
    const value = interaction.values[0];
    let embed = createBaseEmbed();

    if (value === 'help_menu_global') {
        embed.setTitle('🎛️ Le Menu Global (`/menu`)')
            .setDescription('La commande **`/menu`** est votre tableau de bord interactif. Elle remplace presque toutes les autres commandes !')
            .addFields(
                { name: 'Comment ça marche ?', value: 'Tapez simplement `/menu`. Un panneau s\'ouvre avec des boutons cliquables. Vous pouvez cliquer sur "Ma PAL" pour la voir, "Ajouter Livre" pour chercher un livre, ou "Maj Progression" pour indiquer la page que vous venez d\'atteindre.' },
                { name: 'Avantage', value: 'Vous n\'avez plus besoin de mémoriser les commandes ! Tout se fait via des fenêtres pop-up (formulaires) directement dans Discord.' }
            );
    } 
    else if (value === 'help_pal') {
        embed.setTitle('📚 La Pile à Lire (PAL)')
            .setDescription('Suivez l\'avancée de vos lectures en cours et votre liste de souhaits.')
            .addFields(
                { name: 'Multi-livres', value: 'Vous pouvez avoir plusieurs livres "en cours" en même temps. Lorsque vous mettez à jour votre progression via le `/menu`, le bot vous demandera de choisir lequel de vos livres en cours vous avez lu.' },
                { name: 'Fini !', value: 'Si vous entrez un numéro de page supérieur ou égal au nombre total de pages du livre, il passera automatiquement dans la catégorie "Lus" !' },
                { name: 'Commandes directes', value: '`/pal liste`, `/pal ajouter`, `/pal retirer`' }
            );
    }
    else if (value === 'help_sprints') {
        embed.setTitle('⏱️ Les Sprints de Lecture')
            .setDescription('Idéal pour se motiver à lire en groupe ! Un chronomètre est lancé et tout le monde lit en même temps.')
            .addFields(
                { name: 'Lancer un sprint', value: 'Allez dans `/menu` > Sprints > Lancer, ou tapez `/sprint lancer`. Une annonce est faite avec l\'heure de fin.' },
                { name: 'Les scores', value: 'À la fin du sprint, un bouton s\'affiche. Cliquez dessus pour entrer le nombre de pages que vous avez lues pendant le temps imparti. Ces pages seront ajoutées à votre livre en cours !' },
                { name: 'Sons (Vocal)', value: 'Si vous êtes dans un salon vocal avec le bot, une cloche retentira automatiquement au début et à la fin du sprint.' }
            );
    }
    else if (value === 'help_profil') {
        embed.setTitle('🏆 Niveaux et Profil')
            .setDescription('Votre assiduité est récompensée ! Plus vous lisez, plus vous montez en grade.')
            .addFields(
                { name: 'Le profil (`/profil`)', value: 'Affiche votre nombre total de pages lues, vos livres terminés, et une jauge de progression vers votre prochain grade.' },
                { name: 'Les Grades', value: 'Novice 📖 ➔ Apprenti Lecteur ✨ ➔ Lecteur Assidu 🌿 ➔ Bibliophile 🔖 ➔ Érudit 🦉 ➔ Sage des Livres 📜 ➔ Grand Sage ⭐' },
                { name: 'Livraddict', value: 'Vous pouvez lier votre profil Livraddict avec `/livraddict [lien]` pour qu\'il s\'affiche sur votre fiche.' }
            );
    }
    else if (value === 'help_stream') {
        embed.setTitle('🎥 Outils pour les Streamers')
            .setDescription('Affichez vos lectures directement sur votre stream Twitch ou YouTube !')
            .addFields(
                { name: 'L\'Overlay OBS (`/stream overlay`)', value: 'Vous donne un lien privé. Ajoutez-le en tant que "Source Navigateur" sur OBS (450x180). Il affichera la couverture de votre livre, votre progression, et même le timer du sprint en temps réel !' },
                { name: 'Livre Stream', value: 'Si vous lisez plusieurs livres, allez dans `/menu` > "Livre Stream" pour choisir lequel s\'affichera sur OBS.' },
                { name: 'Annonces', value: '`/stream annonce` pour prévenir que vous êtes en live, et `/stream programme` pour donner rendez-vous pour une lecture commune.' }
            );
    }
    else if (value === 'help_musique') {
        embed.setTitle('🎵 Musique et Ambiance')
            .setDescription('Mettez une ambiance cosy pendant que vous lisez.')
            .addFields(
                { name: 'Radios', value: 'Allez dans `/menu` > Musique, ou tapez `/musique jouer`. Le bot rejoindra votre salon vocal et diffusera une radio 24/7 (Lofi Girl, Chillhop ou Jazz).' },
                { name: 'Régler le son', value: 'Pour éviter de surcharger le bot, le volume ne se règle pas par commande. Faites un **clic droit** sur le bot dans le salon vocal et baissez son volume localement.' }
            );
    }

    await interaction.update({ embeds: [embed] });
}
