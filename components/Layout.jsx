// why require React if we don't seem to be using it on page?
var React = require('react');

function Layout(props) {
    return (
        <div>
            <nav>
                {props.isLoggedIn ? <LoggedInNav/> : <LoggedOutNav/>}
            </nav>
            <main>
                <h1>{props.title || 'Reddit Clone'}</h1>
                {props.children}
            </main>
        </div>
    )
}

function LoggedInNav() {
    return (
        <ul>
            <li>
                <a href="/">Home</a>
            </li>
            <li>
                <a href="/createContent">Post new content</a>
            </li>
            <li>
                <a href="/logout">Logout</a>
            </li>
        </ul>
    )
}

function LoggedOutNav() {
    return (
        <ul>
            <li>
                <a href="/">Home</a>
            </li>
            <li>
                <a href="/login">Login</a>
            </li>
            <li>
                <a href="/signup">Signup</a>
            </li>
            
        </ul>
    )
}

module.exports = Layout;