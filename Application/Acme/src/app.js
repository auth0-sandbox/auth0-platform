// app.js - Auth0 Platform and Capabilities
//

import { ManagementClient } from 'auth0'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'
import createError from 'http-errors'
import logger from 'morgan'
import auth0Express from 'express-openid-connect'
import path, { dirname, normalize } from 'path'
import { fileURLToPath } from 'url'

const { auth, requiresAuth } = auth0Express

dotenv.config()

// Calculate the app URL if not set externally
if (!process.env.BASE_URL) {
    process.env.BASE_URL = !process.env.CODESPACE_NAME
        ? `http://localhost:${process.env.PORT}`
        : `https://${process.env.CODESPACE_NAME}-${process.env.PORT}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
}

// Calculae the issuer from the DOMAIN
process.env.ISSUER_BASE_URL = `https://${process.env.DOMAIN}`

// Create an Auth0 client instance for the Management API
const auth0ManagementClient = null
// const auth0ManagementClient = new ManagementClient({
//     domain: process.env.DOMAIN,
//     clientId: process.env.CLIENT_ID,
//     clientSecret: process.env.CLIENT_SECRET
// })

// Create Express
const app = express()

// Assuming this file is in the src directory, find the project directory
const __filename = fileURLToPath(import.meta.url)
const __fileDirectory = dirname(__filename)
const __dirname = normalize(path.join(__fileDirectory, ".."))
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")

app.use(logger("combined"))

// Accept both JSON and URL-encoded bodies, and parse cookies
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// Serve the static files in the public directory
app.use(express.static(path.join(__dirname, "public")))

// Use sessions
app.use(
    session({
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: false,
            sameSite: 'lax',
            secure: false
        }
    })
)

app.use(
    auth({
        issuerBaseURL: `https://${process.env.DOMAIN}`,
        baseURL: process.env.BASE_URL,
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        secret: process.env.SECRET,
        idpLogout: true,
        authRequired: false,
        authorizationParams: {
            response_type: 'code',
            scope: 'openid profile email offline_access'
        }
    })
)

// Set up the middleware for the route paths
app.get("/", async (req, res) => {
    let locals = { haveManagementClient: !!auth0ManagementClient, user: req.oidc && req.oidc.user, total: null, count: null }
    if (locals.user) {
        locals.total = expenses.reduce((accum, expense) => accum + expense.value, 0)
        locals.count = expenses.length
    }
    res.render("home", locals)
})

app.get("/expenses", requiresAuth(), async (req, res, next) => {
    res.render("expenses", {
        haveManagementClient: !!auth0ManagementClient, 
        user: req.oidc && req.oidc.user,
        expenses,
    })
})

// Show user profile from the management API
app.get("/profile", requiresAuth(), async (req, res) => {
    let profile = null
    if (auth0ManagementClient) {
        try {
            profile = await auth0ManagementClient.users.get({ id: req.oidc.user.sub })
        } catch (error) {
            console.log("Error fetching user profile:", error)
        }
    }
    res.render("profile", {
        haveManagementClient: !!auth0ManagementClient, 
        user: req.oidc && req.oidc.user,
        profile: profile ? JSON.stringify(profile, null, 4) : null
    })
})

// Show user information from the authentication and authorization
app.get("/user", requiresAuth(), async (req, res) => {
    res.render("user", {
        haveManagementClient: !!auth0ManagementClient, 
        user: req.oidc && req.oidc.user,
        id_token: req.oidc && req.oidc.idToken,
        access_token: req.oidc && req.oidc.accessToken,
        refresh_token: req.oidc && req.oidc.refreshToken,
    })
})

// Show /userinfo information from the /authorization endpoint
app.get("/userinfo", requiresAuth(), async (req, res) => {
    let userinfo = null
    if (req.oidc.accessToken) {
        try {
            const response = await fetch(`${process.env.ISSUER_BASE_URL}/userinfo`, {
                headers: {
                    ContentType: "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${req.oidc.accessToken?.access_token}`
                }
            })
            if (response.ok) {
                userinfo = await response.json()
            } else {
                console.log("Error fetching userinfo:", response.statusText)
            }
        } catch (error) {
            console.log("Error fetching user /userinfo:", error)
        }
    }
    res.render("userinfo", {
        haveManagementClient: !!auth0ManagementClient, 
        user: req.oidc && req.oidc.user,
        userinfo: userinfo ? JSON.stringify(userinfo, null, 4) : null
    })
})

// Catch 404 and forward to error handler
app.use((req, res, next) => next(createError(404)))

// Error handler
app.use((err, req, res, next) => {
    res.locals.message = err.message
    res.locals.error = err
    res.status(err.status || 500)
    res.render("error", {
        user: req.oidc && req.oidc.user,
    })
})

app.listen(process.env.PORT, () => {
    console.log(`WEB APP: ${process.env.BASE_URL}`)
})

// Expenses
const expenses = [
    {
        date: new Date(),
        description: "Pizza for a Coding Dojo session.",
        value: 102,
    },
    {
        date: new Date(),
        description: "Coffee for a Coding Dojo session.",
        value: 42,
    },
]