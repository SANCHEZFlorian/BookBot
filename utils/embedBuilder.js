import { EmbedBuilder } from 'discord.js';

const COLORS = {
    PRIMARY: '#D4A853', // Ambre/Doré (Thème Cosy)
    SECONDARY: '#7A9E7E', // Vert sauge
    DARK: '#2C1A0E', // Brun sombre
    LIGHT: '#F5E6C8', // Crème
    SUCCESS: '#2ECC71',
    ERROR: '#E74C3C',
    WARNING: '#F1C40F'
};

/**
 * Crée un embed de base avec la couleur principale et le footer par défaut
 * @returns {EmbedBuilder}
 */
export function createBaseEmbed() {
    return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTimestamp()
        .setFooter({ text: 'BookBot 📖', iconURL: null }); // Remplacer par l'URL de l'avatar du bot si disponible
}

/**
 * Crée un embed d'erreur standardisé
 * @param {string} message Le message d'erreur
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(message) {
    return createBaseEmbed()
        .setColor(COLORS.ERROR)
        .setTitle('❌ Erreur')
        .setDescription(message);
}

/**
 * Crée un embed de succès standardisé
 * @param {string} message Le message de succès
 * @returns {EmbedBuilder}
 */
export function createSuccessEmbed(message) {
    return createBaseEmbed()
        .setColor(COLORS.SUCCESS)
        .setTitle('✅ Succès')
        .setDescription(message);
}

/**
 * Crée un embed d'information
 * @param {string} title Titre de l'embed
 * @param {string} description Description de l'embed
 * @returns {EmbedBuilder}
 */
export function createInfoEmbed(title, description) {
    return createBaseEmbed()
        .setTitle(title)
        .setDescription(description);
}

export { COLORS };
