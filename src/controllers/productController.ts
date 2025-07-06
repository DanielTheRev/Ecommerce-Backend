import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { IProductCreate, IProductUpdate } from '../types/product.types';

export class ProductController {
  // GET /api/products - Obtener todos los productos
  static async getAllProducts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const products = await Product.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments();

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // GET /api/products/:id - Obtener un producto por ID
  static async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener el producto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // POST /api/products - Crear un nuevo producto
  static async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const productData: IProductCreate = req.body;

      // Validaciones básicas
      if (!productData.name || !productData.image?.light || !productData.image?.dark) {
        res.status(400).json({
          success: false,
          message: 'Los campos name, image.light e image.dark son requeridos'
        });
        return;
      }

      const product = new Product(productData);
      const savedProduct = await product.save();

      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: savedProduct
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al crear el producto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // PUT /api/products/:id - Actualizar un producto completo
  static async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: IProductUpdate = req.body;

      const product = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al actualizar el producto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // PATCH /api/products/:id - Actualizar parcialmente un producto
  static async patchProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: Partial<IProductUpdate> = req.body;

      const product = await Product.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al actualizar el producto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // DELETE /api/products/:id - Eliminar un producto
  static async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndDelete(id);

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Producto eliminado exitosamente',
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el producto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // GET /api/products/search - Buscar productos
  static async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const { q, minPrice, maxPrice, minRating } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let query: any = {};

      // Búsqueda por texto
      if (q) {
        query.$or = [
          { name: { $regex: q, $options: 'i' } },
          { features: { $in: [new RegExp(q as string, 'i')] } }
        ];
      }

      // Filtros por precio
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice as string);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice as string);
      }

      // Filtro por rating
      if (minRating) {
        query.rating = { $gte: parseFloat(minRating as string) };
      }

      const products = await Product.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments(query);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al buscar productos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}
