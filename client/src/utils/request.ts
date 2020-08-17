import axios from 'axios'
let request = axios.create({
  baseURL: "/api"
})


request.interceptors.response.use(
  // async response => {
  //   let { data } = response
  //   return data
  // }
);

export default request 