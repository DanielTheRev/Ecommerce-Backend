import { Model, FilterQuery, Document } from 'mongoose';

export interface IPaginationOptions {
    page?: number;
    limit?: number;
    sort?: any;
    select?: any;
    populate?: any;
}

export interface IPaginatedResult<T> {
    data: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export const paginate = async <T extends Document>(
    model: Model<T>,
    query: FilterQuery<T> = {},
    options: IPaginationOptions = {}
): Promise<IPaginatedResult<T>> => {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = model.find(query);

    if (options.sort) {
        queryBuilder.sort(options.sort);
    }

    if (options.select) {
        queryBuilder.select(options.select);
    }

    if (options.populate) {
        queryBuilder.populate(options.populate);
    }

    queryBuilder.skip(skip).limit(limit);

    // Run query and count in parallel for performance
    const [data, total] = await Promise.all([
        queryBuilder.lean(),
        model.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        data: data as unknown as T[],
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit
        }
    };
};
