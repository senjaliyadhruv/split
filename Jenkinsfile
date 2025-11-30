pipeline{
    agent any
    stages{
        stage('Git Checkout:'){
         steps{ 
             git branch: 'main', url: 'https://github.com/senjaliyadhruv/split.git'
            echo "Repo cloned successfully"
             
         }
        }
        stage('Docker Build'){
           steps{ 
               dir('frontend'){
                  sh 'docker build -t dhruv1204/frontend:${BUILD_NUMBER} .'
              }
               dir('backend'){
                  sh 'docker build -t dhruv1204/backend:${BUILD_NUMBER} .'
              }
           }
        }
        stage('Docker Login and Image push'){
           steps{
                withCredentials([usernamePassword(credentialsId: 'dockerhub_pass', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]){
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh 'docker push ${DOCKER_USER}/frontend:${BUILD_NUMBER}'
                    sh 'docker push ${DOCKER_USER}/backend:${BUILD_NUMBER}'
                }
            }
        }
          stage('Update manifests') {
            steps {
                script {
                    dir('kubernetes'){
                        sh """
                        sed -i -e s#dhruv1204/backend.*#dhruv1204/backend:${BUILD_NUMBER}#g backend.yaml
                        sed -i -e s#dhruv1204/frontend.*#dhruv1204/frontend:${BUILD_NUMBER}#g frontend.yaml
                        """
                    }
                }
            }
        }
        stage('git commit & push'){
            steps {
                withCredentials([gitUsernamePassword(credentialsId: 'github-cred', gitToolName: 'Default')]) {
                    sh '''
                    git config user.email "jenkins@example.com"
                    git config user.name "Jenkins CI"
                    
                    git status
                    git add kubernetes/
                    git commit -m "Updated deployment image tags to build number ${BUILD_NUMBER}" || echo "No changes to commit"
                    git push origin HEAD:main
                    '''
                }
            }
        }
    }
}
