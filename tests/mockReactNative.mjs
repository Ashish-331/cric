export const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

export const Alert = {
  alert: () => {},
};

export default {
  Platform,
  Alert,
};
