export function validateObjectOnlyHasAllowedFields(obj, allowedFields, path) {
  const errors = [];
  for (const key of Object.keys(obj)) {
    if (!allowedFields.includes(key)) {
      errors.push(path + ': unexpected field "' + key + '"');
    }
  }
  return errors;
}
