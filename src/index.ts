import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import { ContentModel, LinkModel, UserModel } from "./db";
import bcrypt from "bcrypt";
import {isValid, z} from "zod";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

import {JWT_PASSWORD}  from "./config";
import { userMiddleware } from "./middleware";
import { random } from "./utils";




app.post("/api/v1/signup", async (req, res) => {
  
  const isPassword = (password: string) => {
    const specialCharacters = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', ',', '.', '?', ':', '"', '{', '}', '|', '<', '>'];
    return specialCharacters.some(char => password.includes(char)) && [...password].some(char => char >= 'A' && char <= 'Z') && [...password].some(char => char >= 'a' && char <= 'z') && [...password].some(char => char >= '0' && char <= '9'); 
  }

  const requiredBody = z.object({
    username: z.string().email().min(3).max(100),
    password: z.string().min(3).max(25).refine(isPassword)
  })

  const pasrsedDataWithSuccess = requiredBody.safeParse(req.body);
  if(!pasrsedDataWithSuccess.success){
    res.json({
      error: pasrsedDataWithSuccess.error,
      message: "Incorrect format"
    })
    return;
  }

  const {username, password} = req.body;

  let errorThrown = false;
  try{
    const hashedPassword = await bcrypt.hash(password, 5);
    await UserModel.create({
      username: username,
      password: hashedPassword
    })
  }catch(e){
    errorThrown = true;
    res.json({
      message: "User already exists"
    })
    return;
  }

  if(!errorThrown){
    res.json({
      message: "User has signed up"
    });
    return;
  }

});

app.post("/api/v1/signin", async (req, res) => {

  const {username, password} = req.body;

  const existingUser = await UserModel.findOne({
    username
  });

  if(existingUser){
    //@ts-ignore
    const passwordMatch = await bcrypt.compare(password, existingUser.password)
    const token = jwt.sign({
      id: existingUser._id
    }, JWT_PASSWORD);

    res.json({
      token
    })
  }
  else{
    res.json({
      message: "User not found"
    })
  }

});

app.post("/api/v1/content", userMiddleware, async (req, res) => {
  const {link, type, title} = req.body;

  await ContentModel.create({
    link: link,
    title: title,
    type: type,
    //@ts-ignore
    userId: req.userId,
    tags: []
  });

  res.json({
    message: "Content added successfully"
  });
});

app.get("/api/v1/content", userMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  const content = await ContentModel.find({
    userId
  }).populate("userId", "username");
  res.json({
    content
  })
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
  const contentId = req.body.contentId;
  await ContentModel.deleteMany({
    _id: contentId,
    //@ts-ignore
    userId: req.userId
  });

  res.json({
    message: "Content deleted successfully"
  });

});

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
  const { share}  = req.body;
  if(share){
    const existingLink = await LinkModel.findOne({
      //@ts-ignore
      userId: req.userId
    })

    if(existingLink){
      res.json({
        //@ts-ignore
        message: `/brain/:${existingLink.hash}`
      })
      return;
    }
    const hash = random(10);
    await LinkModel.create({
      //@ts-ignore
      userId: req.userId,
      hash: hash
    })
    res.json({
      message: `/brain/:${hash}`
    })
    return;
  }
  else{
    await LinkModel.deleteOne({
      //@ts-ignore
      userId: req.userId
    })

    res.json({
      message: "Removed share link"
    })
    return;
  }
});

app.get("/api/v1/brain/:shareLink", async (req, res) => {
  const hash = req.params.shareLink;
  const link = await LinkModel.findOne({
    hash: hash
  })

  if(!link){
    res.status(411).json({
      message:"Incorrect link, brain not found"
    })
    return;
  }

  const contents = await ContentModel.find({
    //@ts-ignore
    userId: link.userId
  })

  const user = await UserModel.findOne({
    //@ts-ignore
    _id: link.userId
  })

  if(!user){
    res.status(411).json({
      message: "User does not exists"
    })
    return;
  }

  res.json({
    username: user.username,
    contents: contents
  });

});

app.listen(port, () =>{
  console.log(`Listening on port ${port}`);
});