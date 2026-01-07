const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ReturnProductSearchableFields } = require("./returnProduct.constants");
const ReturnProduct = db.returnProduct;
const Product = db.product;


const insertIntoDB = async (data) => {

  const { quantity, productId} = data;

const productData = await Product.findOne({
  where:{
    Id:productId
  }
})

if(!productData){
  throw new ApiError(404, 'Product not found')
}

const updatedQuantity = productData.quantity + quantity;

await Product.update({quantity:updatedQuantity},{
  where:{
    Id:productId
  }
})

const payload = {
  name: productData.name,
  quantity,
  purchase_price:productData.purchase_price * quantity,
  sale_price:productData.sale_price * quantity,
  productId
}


  const result = await ReturnProduct.create(payload);
  return result
};


const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ReturnProductSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      }))
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const result = await ReturnProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const total = await ReturnProduct.count({ where: whereConditions });

  return {
    meta: { total, page, limit },
    data: result,
  };
};




const getDataById = async (id) => {
  
  const result = await ReturnProduct.findOne({
    where:{
      Id:id
    }
  })

  return result
};


const deleteIdFromDB = async (id) => {

  const result = await ReturnProduct.destroy(
    {
      where:{
        Id:id
      }
    }
  )

  return result
};


const updateOneFromDB = async (id, payload) => {
 
  const {name} = payload
  const result = await ReturnProduct.update(payload,{
    where:{
      Id:id
    }
  })

  return result

};

const getAllFromDBWithoutQuery = async () => {
 
  const result = await ReturnProduct.findAll()

  return result

};




const ReturnProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery
};

module.exports = ReturnProductService;