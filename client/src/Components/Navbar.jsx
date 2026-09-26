import React from 'react'
import {AppBar, Typography, Toolbar, Button} from '@mui/material'
import { Link } from 'react-router-dom'

export const Navbar = () => {
    const button = {marginRight:'20px', fontSize:'0.8rem',fontWeight:'600', padding:'0.3rem 1.4rem'};
    return(
        <>
        <AppBar>
            <Toolbar>
                <Typography variant="h5" sx={{flexGrow:1}}>Med-Zoom AI</Typography>
                <Button style={button} color="warning" variant='contained' to="/login" component={Link}>Login</Button>
                <Button style={button} color='warning' variant='contained' to="/signup" component={Link}>Signup</Button>
            </Toolbar>
        </AppBar>
        </>
    )
}