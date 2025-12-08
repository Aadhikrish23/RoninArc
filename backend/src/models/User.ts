import mongoose from "mongoose";

interface UserDocument extends mongoose.Document {
  username: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserDocument>({
  username: {
    type: String,
    required: [true, "User name is required"],
    minLength: 2,
    maxLength: 200,
    trim: true,
    unique: true,
    lowercase: true,
  },
  email:{
    type:String,
    
  },
  passwordHash:{
    type:String,
    required:true,
  }
},{
    timestamps:true
});


const usermodel = mongoose.model<UserDocument>("User",userSchema);

export default usermodel;