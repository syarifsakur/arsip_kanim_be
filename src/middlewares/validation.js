import { StatusCodes } from 'http-status-codes';

const validateData = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      const dataError = error?.issues;
      const errorMessages = {};
      dataError.forEach((item) => {
        let find = item?.path[0];
        errorMessages[find] = item?.message;
      });

      return res.status(StatusCodes.BAD_REQUEST).json(errorMessages);
    }
  };
};

export default validateData;
