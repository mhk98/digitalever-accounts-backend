const parseVariants = require("./parseVariants");

const mergeVariants = (existingVariants, incomingVariants) => {
  const oldVariants = parseVariants(existingVariants);
  const newVariants = parseVariants(incomingVariants);

  const map = new Map();

  // existing
  oldVariants.forEach((item) => {
    const key = `${item.size}__${item.color}`;
    map.set(key, {
      size: item.size,
      color: item.color,
      quantity: Number(item.quantity || 0),
    });
  });

  // incoming
  newVariants.forEach((item) => {
    const key = `${item.size}__${item.color}`;
    const qty = Number(item.quantity || 0);

    if (map.has(key)) {
      const old = map.get(key);
      map.set(key, {
        ...old,
        quantity: old.quantity + qty,
      });
    } else {
      map.set(key, {
        size: item.size,
        color: item.color,
        quantity: qty,
      });
    }
  });

  return Array.from(map.values());
};

module.exports = mergeVariants;
