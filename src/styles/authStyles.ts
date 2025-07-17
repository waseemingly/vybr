import { StyleSheet, Dimensions, Platform } from 'react-native';
import { APP_CONSTANTS } from '@/config/constants';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export const authStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: 'white',
    minHeight: isWeb ? height : '100%',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isWeb ? 40 : 24,
    paddingVertical: isWeb ? 60 : 20,
    position: 'relative',
    minHeight: isWeb ? height : '100%',
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: isWeb ? 600 : 400,
    minHeight: isWeb ? height * 0.8 : 'auto',
    justifyContent: 'space-between',
  },
  formContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: isWeb ? 500 : 350,
    minHeight: isWeb ? height * 0.7 : 'auto',
    justifyContent: 'center',
  },

  // Logo styles
  logoContainer: {
    alignItems: 'center',
    marginBottom: isWeb ? 48 : 32,
    marginTop: isWeb ? 40 : 0,
  },
  logoBackground: {
    backgroundColor: 'white',
    borderRadius: isWeb ? 24 : 20,
    paddingHorizontal: isWeb ? 32 : 24,
    paddingVertical: isWeb ? 20 : 16,
    shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
    shadowOffset: { width: 0, height: isWeb ? 12 : 8 },
    shadowOpacity: 0.15,
    shadowRadius: isWeb ? 20 : 16,
    elevation: 8,
    marginBottom: isWeb ? 20 : 16,
  },
  logoText: {
    fontSize: isWeb ? 56 : 48,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontFamily: 'SF Pro Display, Inter, sans-serif',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: isWeb ? 18 : 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
  },

  // Text styles
  title: {
    fontSize: isWeb ? 32 : 28,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: isWeb ? 16 : 12,
    fontFamily: 'Inter, sans-serif',
  },
  subtitle: {
    fontSize: isWeb ? 18 : 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: isWeb ? 32 : 24,
    fontFamily: 'Inter, sans-serif',
    lineHeight: isWeb ? 26 : 22,
  },
  description: {
    fontSize: isWeb ? 22 : 18,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: isWeb ? 32 : 26,
    fontFamily: 'Inter, sans-serif',
    fontWeight: '400',
  },
  descriptionContainer: {
    marginBottom: isWeb ? 64 : 48,
    paddingHorizontal: isWeb ? 40 : 20,
    flex: isWeb ? 1 : 0,
    justifyContent: 'center',
  },

  // Button styles
  buttonContainer: {
    width: '100%',
    marginBottom: isWeb ? 60 : 40,
  },
  button: {
    backgroundColor: 'white',
    borderRadius: isWeb ? 20 : 16,
    marginBottom: isWeb ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: isWeb ? 6 : 4 },
    shadowOpacity: 0.08,
    shadowRadius: isWeb ? 16 : 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isWeb ? 24 : 20,
    paddingHorizontal: isWeb ? 32 : 24,
  },
  buttonIconContainer: {
    width: isWeb ? 56 : 48,
    height: isWeb ? 56 : 48,
    borderRadius: isWeb ? 16 : 12,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isWeb ? 20 : 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: isWeb ? 20 : 18,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: isWeb ? 6 : 4,
    fontFamily: 'Inter, sans-serif',
  },
  buttonSubtitle: {
    fontSize: isWeb ? 16 : 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontFamily: 'Inter, sans-serif',
  },
  primaryButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    borderRadius: isWeb ? 20 : 16,
    paddingVertical: isWeb ? 20 : 16,
    paddingHorizontal: isWeb ? 32 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
    shadowOffset: { width: 0, height: isWeb ? 8 : 4 },
    shadowOpacity: 0.2,
    shadowRadius: isWeb ? 16 : 8,
    elevation: 6,
    marginBottom: isWeb ? 20 : 16,
  },
  primaryButtonText: {
    fontSize: isWeb ? 18 : 16,
    fontWeight: '600',
    color: 'white',
    fontFamily: 'Inter, sans-serif',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: isWeb ? 20 : 16,
    paddingVertical: isWeb ? 20 : 16,
    paddingHorizontal: isWeb ? 32 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    marginBottom: isWeb ? 20 : 16,
  },
  secondaryButtonText: {
    fontSize: isWeb ? 18 : 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontFamily: 'Inter, sans-serif',
  },

  // Form styles
  form: {
    width: '100%',
    marginBottom: isWeb ? 40 : 32,
  },
  inputContainer: {
    marginBottom: isWeb ? 24 : 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: isWeb ? 16 : 12,
    paddingVertical: isWeb ? 18 : 16,
    paddingHorizontal: isWeb ? 20 : 16,
    fontSize: isWeb ? 16 : 14,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER,
    fontFamily: 'Inter, sans-serif',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputFocused: {
    borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
    shadowOpacity: 0.1,
  },
  inputLabel: {
    fontSize: isWeb ? 16 : 14,
    fontWeight: '500',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: isWeb ? 8 : 6,
    fontFamily: 'Inter, sans-serif',
  },
  inputError: {
    borderColor: APP_CONSTANTS.COLORS.ERROR,
  },
  errorText: {
    fontSize: isWeb ? 14 : 12,
    color: APP_CONSTANTS.COLORS.ERROR,
    marginTop: isWeb ? 6 : 4,
    fontFamily: 'Inter, sans-serif',
  },

  // Link styles
  linkContainer: {
    alignItems: 'center',
    marginTop: isWeb ? 24 : 20,
  },
  link: {
    fontSize: isWeb ? 16 : 14,
    color: APP_CONSTANTS.COLORS.PRIMARY,
    textDecorationLine: 'underline',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
  },
  linkText: {
    fontSize: isWeb ? 16 : 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontFamily: 'Inter, sans-serif',
  },

  // Footer styles
  footer: {
    alignItems: 'center',
    paddingHorizontal: isWeb ? 40 : 20,
    marginTop: isWeb ? 'auto' : 0,
  },
  footerText: {
    fontSize: isWeb ? 16 : 14,
    color: APP_CONSTANTS.COLORS.TEXT_TERTIARY,
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif',
  },

  // Decorative elements
  decorativeCircle1: {
    position: 'absolute',
    top: isWeb ? height * 0.05 : height * 0.1,
    right: isWeb ? width * 0.15 : width * 0.1,
    width: isWeb ? 160 : 120,
    height: isWeb ? 160 : 120,
    borderRadius: isWeb ? 80 : 60,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: isWeb ? height * 0.15 : height * 0.2,
    left: isWeb ? width * 0.08 : width * 0.05,
    width: isWeb ? 120 : 80,
    height: isWeb ? 120 : 80,
    borderRadius: isWeb ? 60 : 40,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}08`,
  },
  decorativeCircle3: {
    position: 'absolute',
    top: isWeb ? height * 0.25 : height * 0.3,
    left: isWeb ? width * 0.2 : width * 0.15,
    width: isWeb ? 100 : 60,
    height: isWeb ? 100 : 60,
    borderRadius: isWeb ? 50 : 30,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}06`,
  },
  decorativeCircle4: {
    position: 'absolute',
    top: isWeb ? height * 0.4 : 0,
    right: isWeb ? width * 0.05 : 0,
    width: isWeb ? 80 : 0,
    height: isWeb ? 80 : 0,
    borderRadius: isWeb ? 40 : 0,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}05`,
  },
  decorativeCircle5: {
    position: 'absolute',
    bottom: isWeb ? height * 0.35 : 0,
    right: isWeb ? width * 0.25 : 0,
    width: isWeb ? 140 : 0,
    height: isWeb ? 140 : 0,
    borderRadius: isWeb ? 70 : 0,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}07`,
  },

  // Divider styles
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: isWeb ? 24 : 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: APP_CONSTANTS.COLORS.BORDER,
  },
  dividerText: {
    fontSize: isWeb ? 14 : 12,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginHorizontal: isWeb ? 16 : 12,
    fontFamily: 'Inter, sans-serif',
  },

  // Loading and disabled states
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: isWeb ? 16 : 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginLeft: isWeb ? 12 : 8,
    fontFamily: 'Inter, sans-serif',
  },
}); 