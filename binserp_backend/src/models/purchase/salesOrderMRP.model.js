import mongoose from "mongoose";

export const salesOrderMRPSchema = new mongoose.Schema({
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  salesOrder: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'SalesOrder', 
    required: true 
  },
  orderNumber: { 
    type: String, 
    required: true 
  },
  targetDate: { 
    type: Date 
  },
  items: [{
    material: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'RmBoItem' 
    },
    materialName: { 
      type: String 
    },
    requiredQuantity: { 
      type: Number, 
      default: 0 
    },
    stockAvailable: { 
      type: Number, 
      default: 0 
    },
    shortage: { 
      type: Number, 
      default: 0 
    },
    status: { 
      type: String, 
      enum: ['Pending', 'PO Raised', 'Fulfilled'],
      default: 'Pending'
    }
  }],
  status: { 
    type: String, 
    enum: ['Open', 'Completed'], 
    default: 'Open' 
  }
}, { timestamps: true });
